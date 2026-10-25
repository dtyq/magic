function fallbackWriteText(value: string) {
	const textarea = document.createElement("textarea")
	textarea.value = value
	textarea.setAttribute("readonly", "")
	textarea.style.position = "fixed"
	textarea.style.opacity = "0"
	textarea.style.pointerEvents = "none"
	document.body.appendChild(textarea)
	textarea.select()

	try {
		if (!document.execCommand("copy")) throw new Error("Copy command failed")
	} finally {
		textarea.remove()
	}
}

async function writeText(value: string) {
	if (navigator.clipboard?.writeText) {
		try {
			await navigator.clipboard.writeText(value)
			return
		} catch (error) {
			void error
		}
	}

	fallbackWriteText(value)
}

export const clipboard = { writeText }
