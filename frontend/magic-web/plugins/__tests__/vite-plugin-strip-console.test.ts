import { describe, expect, test } from "vitest"
import vitePluginStripConsole, { stripConsole } from "../vite-plugin-strip-console"

const run = (code: string, id = "/virtual/test.ts") => stripConsole(code, id, "keep-console")

/** What a removed statement of `source` turns into: `;` padded to the original length. */
const emptied = (source: string) => ";".padEnd(source.length, " ")
/** What a removed value-position call of `source` turns into. */
const undef = (source: string) => "undefined".padEnd(source.length, " ")

describe("stripConsole", () => {
	test("replaces console expression statements with an empty statement of equal length", () => {
		expect(run("a()\nconsole.log(1)\nb()")).toBe(`a()\n${emptied("console.log(1)")}\nb()`)
	})

	test("replaces value-position calls with undefined", () => {
		expect(run("const f = () => console.log(x)\nconst v = cond && console.warn(1)")).toBe(
			`const f = () => ${undef("console.log(x)")}\nconst v = cond && ${undef("console.warn(1)")}`,
		)
	})

	test("keeps calls protected by a comment before, inside or after", () => {
		const code = [
			"/** keep-console */ console.log(1)",
			"console.log(/** keep-console */ 2)",
			"console.log(3) // keep-console",
			"// keep-console",
			"console.log(4)",
		].join("\n")
		expect(run(code)).toBeNull()
	})

	test("only the protected call survives when mixed", () => {
		expect(run("console.log(1)\nconsole.log(/** keep-console */ 2)")).toBe(
			`${emptied("console.log(1)")}\nconsole.log(/** keep-console */ 2)`,
		)
	})

	test("keeps statement validity for single-statement bodies", () => {
		expect(run("if (x) console.log(1)\nelse console.log(2)")).toBe(
			`if (x) ${emptied("console.log(1)")}\nelse ${emptied("console.log(2)")}`,
		)
	})

	test("handles computed access and nested calls", () => {
		const call = 'console["log"](console.log(1))'
		expect(run(`${call}\nx()`)).toBe(`${emptied(call)}\nx()`)
	})

	test("ignores optional chains, other objects and strings", () => {
		expect(run('console?.log(1)\nlogger.console.log(1)\nconst s = "console.log(1)"')).toBeNull()
	})

	test("parses tsx and typescript syntax", () => {
		const call = "console.log(p)"
		expect(
			run(
				`const A = <T,>(p: T) => { ${call}; return <div>{p as any}</div> }`,
				"/virtual/a.tsx",
			),
		).toBe(`const A = <T,>(p: T) => { ${emptied(`${call};`)} return <div>{p as any}</div> }`)
	})

	test("leaves unparseable code untouched", () => {
		expect(run("console.log(1) }}}")).toBeNull()
	})

	test("recognises console wrapped in parentheses or TS assertions", () => {
		for (const wrapped of ["(console)", "console!", "(console as any)", "(<any>console)"]) {
			const call = `${wrapped}.log(1)`
			expect(run(`${call}\nx()`), wrapped).toBe(`${emptied(call)}\nx()`)
		}
	})

	describe("ASI safety", () => {
		test("keeps the terminator when the next line starts with a bracket (semicolon style)", () => {
			const output = run("const a = 1\nconsole.log(a);\n[1, 2].forEach(f)")!
			// The `;` left behind terminates `const a = 1`; without it this would read `1[1, 2]`.
			expect(output.replace(/ +/g, " ")).toBe("const a = 1\n; \n[1, 2].forEach(f)")
		})

		test("keeps prettier's leading `;` that terminates the previous statement", () => {
			// In no-semi style the `;` before `[` belongs to `console.log(a)` and used to be deleted with it.
			const lines = run("const a = 1\nconsole.log(a)\n;[1, 2].forEach(f)")!.split("\n")
			expect(lines[0]).toBe("const a = 1")
			// The terminator now sits on the emptied statement's first line, before the bracket line.
			expect(lines[1].startsWith(";")).toBe(true)
			expect(lines[2].trim()).toBe("[1, 2].forEach(f)")
		})
	})

	describe("position preservation (keeps `map: null` accurate)", () => {
		test("output has the same length and line structure as the input", () => {
			const code = [
				"const a = 1",
				"console.log(",
				"  a,",
				"  b,",
				")",
				"const f = () => console\n\t.log(a)",
				"console.warn(a); const z = 3",
			].join("\n")
			const output = run(code)!

			expect(output.length).toBe(code.length)
			expect(output.split("\n").length).toBe(code.split("\n").length)
			// Untouched code keeps its exact offset (and therefore line and column).
			expect(output.indexOf("const z = 3")).toBe(code.indexOf("const z = 3"))
		})
	})
})

describe("vitePluginStripConsole", () => {
	const plugin = vitePluginStripConsole()
	const transform = plugin.transform as unknown as {
		filter: { id: RegExp; code: RegExp }
		handler: (code: string, id: string) => { code: string; map: null } | null
	}

	/** Mirrors Rolldown: the native filter decides whether the handler is called at all. */
	const runThroughPlugin = (code: string, id = "/virtual/test.ts") =>
		transform.filter.id.test(id) && transform.filter.code.test(code)
			? transform.handler(code, id)
			: null

	test("filters natively to script modules that mention console", () => {
		expect(transform.filter.id.test("/a/b.tsx")).toBe(true)
		expect(transform.filter.id.test("/a/b.tsx?x")).toBe(false)
		expect(transform.filter.id.test("/a/b.css")).toBe(false)
		expect(transform.filter.code.test("console.log(1)")).toBe(true)
		expect(transform.filter.code.test("const x = 1")).toBe(false)
	})

	test("the native filter admits every form the AST check can strip", () => {
		// Regression: the filter once required `console` to be followed by `.` or `[`, so wrapped
		// forms were skipped before the handler ever ran.
		const forms = [
			"console.log(1)",
			'console["log"](1)',
			"console\n.log(1)",
			"console /* c */ .log(1)",
			"(console).log(1)",
			"console!.log(1)",
			"(console as any).log(1)",
			"(<any>console).log(1)",
			"(console satisfies Console).log(1)",
		]
		for (const call of forms) {
			const result = runThroughPlugin(`${call}\nx()`)
			expect(result, call).not.toBeNull()
			expect(result!.code.includes("console"), call).toBe(false)
			expect(result!.map).toBeNull()
		}
	})
})
