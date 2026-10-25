/// <reference types="vite/client" />
/// <reference types="../types" />

// Support importing CSS files
declare module "*.css" {
	const content: string
	export default content
}

declare module "virtual:magic-api" {
	const preludeScript: string
	export default preludeScript
}

declare module "virtual:magic-iframe-runtime" {
	const scripts: Readonly<Record<string, string>>
	export default scripts
}
