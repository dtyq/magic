import type { SuperMagicMessageItem } from "./type"

/** One failed call inside a folded run, as the lead card lists it. */
export interface FoldedToolAttempt {
	toolCallId: string
	question: string
	error: string
}

export interface FoldedToolRuns {
	/** Source indices of messages the list leaves out: later failures of a run and the
	 *  reasoning-only messages between them. */
	hiddenSourceIndices: ReadonlySet<number>
	/** Lead tool call id → every attempt of its run (the lead first); only runs of 2 or more. */
	attemptsByLeadId: ReadonlyMap<string, FoldedToolAttempt[]>
}

/**
 * Tools whose repeated identical failures fold into one card. Only AI research's interview tool
 * for now; it exists in research topics alone, so other conversations never fold anything.
 */
const FOLDABLE_TOOLS = new Set(["persona_chat"])

const EMPTY_RUNS: FoldedToolRuns = {
	hiddenSourceIndices: new Set(),
	attemptsByLeadId: new Map(),
}

interface ToolResult {
	status?: string
	detail?: unknown
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return !!value && typeof value === "object" && !Array.isArray(value)
}

function text(value: unknown): string {
	return typeof value === "string" ? value.trim() : ""
}

/** A field read from the message or its `debug` copy (history messages keep tool data there). */
function field(node: SuperMagicMessageItem, key: string): unknown {
	const value = node?.[key]
	if (value !== undefined && value !== null) return value
	return isRecord(node?.debug) ? node.debug[key] : undefined
}

/** The one foldable tool call an assistant message makes, or null. */
function soleFoldableCall(node: SuperMagicMessageItem) {
	if (node?.role === "tool") return null
	const toolCalls = field(node, "tool_calls")
	const calls = Array.isArray(toolCalls) ? toolCalls : []
	if (calls.length !== 1 || !isRecord(calls[0])) return null
	const call = calls[0] as Record<string, unknown>
	const fn = isRecord(call.function) ? call.function : {}
	const name = text(fn.name)
	const id = text(call.id)
	if (!id || !FOLDABLE_TOOLS.has(name)) return null
	return { id, call }
}

/**
 * A whole-call failure keyed by its user-facing reason: no answers, no per-persona failures,
 * only an error. Partial answers or success return null and end a run.
 */
function failureOf(result: ToolResult | undefined, call: Record<string, unknown>) {
	if (!result || result.status !== "error") return null
	const detail = isRecord(result.detail) ? result.detail : null
	const data = detail && isRecord(detail.data) ? detail.data : null
	if (!data) return null
	const answers = Array.isArray(data.answers) ? data.answers.length : 0
	const failed = Array.isArray(data.failed) ? data.failed.length : 0
	const error = text(data.error)
	if (answers || failed || !error) return null
	let question = text(data.question)
	if (!question) {
		try {
			const args = JSON.parse(text((call.function as Record<string, unknown>)?.arguments))
			question = isRecord(args) ? text(args.question) : ""
		} catch {
			question = ""
		}
	}
	// The reason code, when the backend sends it, is a steadier key than the translated text.
	return { key: text(data.error_reason) || error, error, question }
}

/** Messages that neither break nor show inside a run: tool results and silent reasoning. */
function isTransparent(node: SuperMagicMessageItem): boolean {
	if (node?.role === "tool") return true
	if (node?.role !== "assistant") return false
	const toolCalls = field(node, "tool_calls")
	const hasCalls = Array.isArray(toolCalls) && toolCalls.length > 0
	return !hasCalls && !text(field(node, "content"))
}

/**
 * Folds runs of the same tool failing for the same reason with nothing else said in between,
 * e.g. thirty "invalid interview request" cards after the AI ran out of rounds. A success, a
 * different tool, a different reason, visible text or a user message ends the run; a single
 * failure is left as it is.
 */
export function buildFoldedToolRuns(
	messages: ReadonlyArray<SuperMagicMessageItem>,
): FoldedToolRuns {
	const results = new Map<string, ToolResult>()
	let hasFoldable = false
	for (const node of messages) {
		const tool = node?.role === "tool" ? field(node, "tool") : undefined
		if (isRecord(tool) && text(tool.id)) results.set(text(tool.id), tool as ToolResult)
		if (!hasFoldable && soleFoldableCall(node)) hasFoldable = true
	}
	if (!hasFoldable) return EMPTY_RUNS

	const hidden = new Set<number>()
	const attemptsByLeadId = new Map<string, FoldedToolAttempt[]>()
	let run: { key: string; attempts: FoldedToolAttempt[] } | null = null
	let between: number[] = []

	const endRun = () => {
		if (run && run.attempts.length > 1)
			attemptsByLeadId.set(run.attempts[0].toolCallId, run.attempts)
		run = null
		between = []
	}

	messages.forEach((node, index) => {
		const foldable = soleFoldableCall(node)
		if (foldable) {
			const result =
				results.get(foldable.id) ??
				(isRecord(foldable.call.tool) ? (foldable.call.tool as ToolResult) : undefined)
			const failure = failureOf(result, foldable.call)
			if (!failure) {
				endRun()
				return
			}
			const attempt = {
				toolCallId: foldable.id,
				question: failure.question,
				error: failure.error,
			}
			if (run && run.key === failure.key) {
				run.attempts.push(attempt)
				hidden.add(index)
				for (const betweenIndex of between) hidden.add(betweenIndex)
				between = []
			} else {
				endRun()
				run = { key: failure.key, attempts: [attempt] }
			}
			return
		}
		if (run && isTransparent(node)) {
			between.push(index)
			return
		}
		endRun()
	})
	endRun()

	return attemptsByLeadId.size ? { hiddenSourceIndices: hidden, attemptsByLeadId } : EMPTY_RUNS
}
