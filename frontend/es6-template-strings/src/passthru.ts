export default function (literals: Array<string>, ..._substitutions: Array<string>) {
	// eslint-disable-next-line prefer-rest-params
	const args = arguments
	return literals.reduce((a: string, b: string, i: number): string => {
		return a + (args[i] === undefined ? "" : String(args[i])) + b
	})
}
