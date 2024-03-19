declare module "esniff" {
	interface EsniffStatic {
		(code: string, token: string, callback: (j: number) => void): void

		nest: number
		next: () => void
	}

	const esniff: EsniffStatic
	export default esniff
}

declare module "esniff/is-var-name-valid" {
	export default function isVarNameValid(name: string): boolean
}
