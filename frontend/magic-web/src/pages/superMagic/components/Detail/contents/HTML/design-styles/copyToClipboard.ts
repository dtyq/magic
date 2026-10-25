export async function copyToClipboard(value: string) {
	if (!value || typeof document === "undefined") return false

	try {
		if (navigator.clipboard?.writeText) {
			await navigator.clipboard.writeText(value)
			return true
		}
	} catch {
		// Continue with the document fallback for insecure contexts and older browsers.
	}

	const textarea = document.createElement("textarea")
	textarea.value = value
	textarea.setAttribute("readonly", "true")
	textarea.style.position = "fixed"
	textarea.style.opacity = "0"
	document.body.appendChild(textarea)
	textarea.select()
	const copied = document.execCommand("copy")
	document.body.removeChild(textarea)
	return copied
}
