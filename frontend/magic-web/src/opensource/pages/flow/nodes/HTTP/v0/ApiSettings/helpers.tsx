/** 查找被{}包裹的字符串 */
export function findBracedStrings(inputString: string) {
	const regex = /\{([^}]+)\}/g
	const matches = []
	let match

	while ((match = regex.exec(inputString)) !== null) {
		matches.push(match[1])
	}

	return matches
}

export default {}
