import type { Plugin } from "vite"
import {
	createSourceFile,
	getTrailingCommentRanges,
	isCallExpression,
	isAsExpression,
	isElementAccessExpression,
	isIdentifier,
	isNonNullExpression,
	isParenthesizedExpression,
	isPropertyAccessExpression,
	isSatisfiesExpression,
	isTypeAssertionExpression,
	ScriptKind,
	ScriptTarget,
	SyntaxKind,
	type CallExpression,
	type Expression,
	type Node,
	type SourceFile,
} from "typescript"

/**
 * Production-only replacement for `vite-plugin-keep-console`.
 *
 * The old plugin ran a full Babel parse + traverse + regenerate (with sourcemaps) on every
 * ts/tsx/js/jsx module, ~29k of them including node_modules, although only a few percent
 * mention `console`. This plugin keeps the same semantics but:
 * - skips modules without `console.` via a native hook filter (no JS call at all);
 * - parses the remaining ones with the TypeScript parser (no type-check);
 * - edits by source ranges instead of regenerating code, so untouched code stays byte-identical.
 *
 * Semantics (same as before): every `console.x(...)` / `console[x](...)` call is removed unless
 * a comment containing the keep marker sits before/after the call or its statement, or inside
 * the call. A removed expression statement becomes an empty statement; a call used as a value
 * becomes `undefined`. `console` wrapped in parentheses or a TS assertion is recognised too.
 *
 * Every replacement keeps the original length and line breaks (see `blankOut`). That keeps all
 * untouched positions valid, so returning `map: null` stays accurate when sourcemaps are on, and
 * leaving a `;` behind keeps the statement terminator that ASI-sensitive neighbours rely on
 * (prettier's no-semi style puts a leading `;` before `[`/`(` lines, which belongs to the
 * previous statement and would otherwise be deleted with it).
 */

const DEFAULT_KEEP_MARKER = "keep-console"
// Same module set as the old plugin: matched against the raw id, so query ids are skipped.
const SCRIPT_ID_FILTER = /\.(?:ts|tsx|js|jsx)$/
// Cheap prefilter. It must be a superset of what `isConsoleCall` accepts, so it only requires the
// identifier itself: `console` can be followed by `)`, `!`, ` as X`, a comment or a line break
// before the member access. False positives (strings, comments) just fall through to the AST check.
const CONSOLE_CODE_FILTER = /\bconsole\b/

interface StripConsoleOptions {
	/** Comment text that protects a console call from removal. */
	keepMarker?: string
}

interface Edit {
	start: number
	end: number
	text: string
}

function getScriptKind(id: string): ScriptKind {
	if (id.endsWith(".tsx")) return ScriptKind.TSX
	if (id.endsWith(".jsx")) return ScriptKind.JSX
	if (id.endsWith(".js")) return ScriptKind.JS
	return ScriptKind.TS
}

function isConsoleCall(node: Node): node is CallExpression {
	if (!isCallExpression(node)) return false
	const callee = node.expression
	// Optional chains (`console?.log`) were never matched by the old plugin; keep that.
	if (!isPropertyAccessExpression(callee) && !isElementAccessExpression(callee)) return false
	if (callee.questionDotToken) return false
	const target = skipTransparentWrappers(callee.expression)
	return isIdentifier(target) && target.text === "console"
}

/** `(console)`, `console!`, `console as X`, `<X>console`, `console satisfies X` are still `console`. */
function skipTransparentWrappers(node: Expression): Expression {
	let current = node
	while (
		isParenthesizedExpression(current) ||
		isNonNullExpression(current) ||
		isAsExpression(current) ||
		isTypeAssertionExpression(current) ||
		isSatisfiesExpression(current)
	) {
		current = current.expression
	}
	return current
}

/**
 * Replaces `[start, end)` with `text` padded by spaces to the original length. Line breaks are
 * kept so the line count never changes, even if one sits inside the first `text.length` chars.
 */
function blankOut(source: string, start: number, end: number, text: string): Edit {
	const original = source.slice(start, end)
	const blanked = original.replace(/[^\r\n]/g, " ")
	// Line breaks inside the first `text.length` chars would be overwritten; re-add them after the
	// text and shorten the padding by the same amount so the total length stays unchanged.
	const swallowed =
		original
			.slice(0, text.length)
			.match(/\r\n|\r|\n/g)
			?.join("") ?? ""
	const padding = blanked.slice(text.length + swallowed.length)
	return { start, end, text: text + swallowed + padding }
}

/** Text that the old Babel logic considered: leading/trailing/inner comments of call and statement. */
function hasKeepMarker(node: Node, statement: Node | undefined, source: string, marker: string) {
	const scope = statement ?? node
	// getFullStart includes leading trivia (comments) which is where `// keep-console` lives.
	const scoped = source.slice(scope.getFullStart(), scope.getEnd())
	if (scoped.includes(marker)) return true

	const trailing = getTrailingCommentRanges(source, scope.getEnd())
	return Boolean(trailing?.some((range) => source.slice(range.pos, range.end).includes(marker)))
}

function collectEdits(sourceFile: SourceFile, source: string, marker: string): Edit[] {
	const edits: Edit[] = []

	const visit = (node: Node) => {
		if (isConsoleCall(node)) {
			const parent = node.parent
			const statement = parent.kind === SyntaxKind.ExpressionStatement ? parent : undefined

			if (!hasKeepMarker(node, statement, source, marker)) {
				// Always `;` for statements: valid in lists and single-statement bodies
				// (`if (x) console.log()`), and it preserves the terminator for ASI neighbours.
				const target = statement ?? node
				edits.push(
					blankOut(
						source,
						target.getStart(sourceFile),
						target.getEnd(),
						statement ? ";" : "undefined",
					),
				)
			}
			// Nested console calls live inside the replaced range (or are kept with their parent).
			return
		}

		node.forEachChild(visit)
	}

	visit(sourceFile)
	return edits
}

function applyEdits(source: string, edits: Edit[]): string {
	let result = ""
	let cursor = 0
	for (const edit of edits.sort((a, b) => a.start - b.start)) {
		result += source.slice(cursor, edit.start) + edit.text
		cursor = edit.end
	}
	return result + source.slice(cursor)
}

export function stripConsole(code: string, id: string, keepMarker: string): string | null {
	const sourceFile = createSourceFile(
		id,
		code,
		ScriptTarget.Latest,
		// Parent pointers are required to tell expression statements from value positions.
		true,
		getScriptKind(id),
	)
	// Never edit a tree the parser had to recover; leaving console calls in is the safe failure.
	const diagnostics = (sourceFile as unknown as { parseDiagnostics?: unknown[] }).parseDiagnostics
	if (diagnostics?.length) return null

	const edits = collectEdits(sourceFile, code, keepMarker)
	return edits.length > 0 ? applyEdits(code, edits) : null
}

export default function vitePluginStripConsole({
	keepMarker = DEFAULT_KEEP_MARKER,
}: StripConsoleOptions = {}): Plugin {
	return {
		name: "magic-strip-console",
		enforce: "pre",
		apply: "build",
		transform: {
			// Hook filters are evaluated natively by Rolldown, so non-matching modules never enter JS.
			filter: { id: SCRIPT_ID_FILTER, code: CONSOLE_CODE_FILTER },
			handler(code, id) {
				const transformed = stripConsole(code, id, keepMarker)
				// Replacements preserve length and line breaks, so a null map keeps positions accurate.
				return transformed === null ? null : { code: transformed, map: null }
			},
		},
	}
}
