export type PreprocessRule = {
	regex: RegExp
	replace: (match: string, ...args: string[]) => string
}
