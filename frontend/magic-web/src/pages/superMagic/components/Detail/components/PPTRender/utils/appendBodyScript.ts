/** Appends a runtime-only script before </body> (or at the end). */
export function appendBodyScript(content: string, script: string): string {
	return /<\/body\s*>/i.test(content)
		? content.replace(/<\/body\s*>/i, () => `${script}</body>`)
		: `${content}${script}`
}
