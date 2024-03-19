import esniff from "esniff"
import type { CompileOptions } from "./types"

let i: number
let current: string
let literals: null | Array<string>
let substitutions: null | Array<string>
let template: string

/** 字符串模版语法的前缀 */
let Notation: string = "$"
/** 字符串模版语法的开始标记 */
let NotationStart: string = "{"
/** 字符串模版语法的结束标记 */
let NotationEnd: string = "}"

export interface Result {
	literals: string[]
	substitutions: string[]
}

type State = (char: string) => State

class Compile {
	static sOut: State = (char) => {
		if (char === "\\") return Compile.sEscape
		if (char === Notation) return Compile.sAhead
		current += char
		return Compile.sOut
	}

	static sEscape: State = (char) => {
		if (char !== "\\" && char !== Notation) {
			current += "\\"
		}
		current += char
		return Compile.sOut
	}

	static sAhead: State = (char) => {
		if (char === NotationStart) {
			literals?.push(current)
			current = ""
			return Compile.sIn
		}
		if (char === Notation) {
			current += Notation
			return Compile.sAhead
		}
		current += Notation + char
		return Compile.sOut
	}

	static sIn: State = () => {
		const code = template.slice(i)
		let end

		// eslint-disable-next-line consistent-return
		esniff(code, NotationEnd, (j: number) => {
			if (esniff.nest >= 0) return esniff.next()
			end = j
		})
		if (end != null) {
			substitutions?.push(template.slice(i, i + end))
			i += end
			current = ""
			return Compile.sOut
		}
		end = code.length
		i += end
		current += code
		return Compile.sIn
	}

	static sInEscape: State = function (char) {
		if (char !== "\\" && char !== NotationEnd) {
			current += "\\"
		}
		current += char
		return Compile.sIn
	}
}

export default function compile(str: string, options?: CompileOptions): Result {
	current = ""
	literals = []
	substitutions = []

	Notation = options?.notation || "$"
	NotationStart = options?.notationStart || "{"
	NotationEnd = options?.notationEnd || "}"

	template = String(str)
	const { length } = template

	let state: State = Compile.sOut
	for (i = 0; i < length; i += 1) {
		state = state(template[i])
	}
	if (state === Compile.sOut) {
		literals.push(current)
	} else if (state === Compile.sEscape) {
		literals.push(`${current}\\`)
	} else if (state === Compile.sAhead) {
		literals.push(current + Notation)
	} else if (state === Compile.sIn) {
		literals[literals.length - 1] += `${Notation}${NotationStart}${current}`
	} else if (state === Compile.sInEscape) {
		literals[literals.length - 1] += `${Notation}${NotationStart}${current}\\`
	}

	const result: Result = { literals, substitutions }
	literals = null
	substitutions = null
	return result
}
