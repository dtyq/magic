export const MAX_REGEX_QUERY_LENGTH = 256

/**
 * Reject the most common nested-quantifier shape before handing user input to JavaScript RegExp.
 * This keeps ordinary patterns such as `^`, `.*`, and `a*` valid while blocking obvious ReDoS cases.
 */
export function isPotentiallyUnsafeRegex(value: string): boolean {
	const hasBackreference = /\\(?:[1-9]|k<[^>]+>)/.test(value)
	// A quantified group whose body contains another quantifier is the most common
	// source of catastrophic backtracking (for example `^(a?)*$`, `(a{1,3})+`,
	// or `(.*)+`).  This deliberately errs on the safe side: these patterns are
	// rejected before they can reach a synchronous RegExp consumer.
	const hasNestedQuantifier = (() => {
		const groups: Array<{ hasQuantifier: boolean }> = []
		let escaped = false
		for (let index = 0; index < value.length; index += 1) {
			const char = value[index]
			if (escaped) {
				escaped = false
				continue
			}
			if (char === "\\") {
				escaped = true
				continue
			}
			if (char === "(") {
				groups.push({ hasQuantifier: false })
				continue
			}
			if (char === ")") {
				const group = groups.pop()
				if (!group) continue
				const next = value[index + 1]
				const isOuterQuantifier =
					next === "*" || next === "+" || next === "?" || next === "{"
				if (group.hasQuantifier && isOuterQuantifier) return true
				if (group.hasQuantifier && groups.length > 0) {
					groups[groups.length - 1].hasQuantifier = true
				}
				continue
			}
			// `?` immediately after `(` is part of group syntax (`(?:`, `(?=`, ...),
			// not a quantifier applied to the group's contents.
			if (
				(char === "*" || char === "+" || char === "?" || char === "{") &&
				!(char === "?" && value[index - 1] === "(")
			) {
				if (groups.length > 0) groups[groups.length - 1].hasQuantifier = true
			}
		}
		return false
	})()
	const hasOverlappingQuantifiedAlternation = Array.from(
		value.matchAll(/\(([^()]*)\)(?:[+*]|\{\d)/g),
	).some(([, body]) => {
		const alternatives = body.split("|")
		if (alternatives.length > 1 && alternatives.some((alternative) => alternative === "")) {
			return true
		}
		return alternatives.some((left, index) =>
			alternatives.some(
				(right, otherIndex) =>
					index !== otherIndex &&
					Boolean(left) &&
					Boolean(right) &&
					right.startsWith(left),
			),
		)
	})

	return (
		value.length > MAX_REGEX_QUERY_LENGTH ||
		hasBackreference ||
		hasNestedQuantifier ||
		hasOverlappingQuantifiedAlternation ||
		/\([^()\n]*[+*](?:[^()\n]*)\)(?:[+*]|\{\d)/.test(value)
	)
}

export function tryCreateRegex(
	pattern: string,
	flags: string,
	validatePattern = true,
): RegExp | null {
	if (validatePattern && isPotentiallyUnsafeRegex(pattern)) return null

	try {
		return new RegExp(pattern, flags)
	} catch {
		return null
	}
}
