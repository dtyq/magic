/// <reference types="vite/client" />
/// <reference types="../types" />

// Support importing CSS files
declare module "*.css" {
	const content: string
	export default content
}
