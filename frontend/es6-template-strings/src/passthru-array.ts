// @ts-ignore
export default (literals: Array<string>, ...substitutions: Array<string>): Array<string> => {
	const result: Array<string> = []
	const l = literals.length
	if (!l) {
		return result
	}
	result.push(literals[0])
	for (let i = 1; i < l; i += 1) {
		// @ts-ignore
		result.push(arguments[i], literals[i])
	}
	return result
}
