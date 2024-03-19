/**
 * Element Selector Utility
 * Finds elements by selector
 */

/**
 * Find element by selector
 */
export function findElement(selector: string): HTMLElement {
	const element = document.querySelector(selector) as HTMLElement
	if (!element) {
		throw new Error(`Element not found: ${selector}`)
	}
	return element
}

/**
 * Get unique selector for an element
 */
export function getElementPath(element: HTMLElement): string {
	if (!element || element.nodeType !== Node.ELEMENT_NODE) {
		return ""
	}

	const path: string[] = []
	let current: HTMLElement | null = element

	while (
		current &&
		current.nodeType === Node.ELEMENT_NODE &&
		current !== document.documentElement
	) {
		if (!current) break
		const currentElement: HTMLElement = current
		let selector = currentElement.tagName.toLowerCase()

		// Use ID if available - ID is unique, so we can stop here
		if (currentElement.id) {
			selector += `#${CSS.escape(currentElement.id)}`
			path.unshift(selector)
			break
		}

		// Add all classes (excluding editor classes)
		const classes: string[] = []
		if (currentElement.className && typeof currentElement.className === "string") {
			const classList = currentElement.className
				.trim()
				.split(" ")
				.filter((cls) => cls && !cls.startsWith("__editor-"))
			classes.push(...classList)
		}

		// Build base selector with classes
		let baseSelector = selector
		if (classes.length > 0) {
			baseSelector += classes.map((cls) => `.${CSS.escape(cls)}`).join("")
		}

		// Check if we need an index to make selector unique among siblings
		const parentElement: HTMLElement | null = currentElement.parentElement
		if (parentElement) {
			const siblings = Array.from(parentElement.children)

			// Find siblings that match the same base selector (tag + classes)
			const matchingSiblings = siblings.filter((child) => {
				if (child.tagName.toLowerCase() !== currentElement.tagName.toLowerCase()) {
					return false
				}

				// Compare classes
				const childClasses =
					child.className
						?.trim()
						.split(" ")
						.filter((cls: string) => cls && !cls.startsWith("__editor-"))
						.sort() || []
				const sortedClasses = [...classes].sort()

				return JSON.stringify(childClasses) === JSON.stringify(sortedClasses)
			})

			// If multiple siblings match, add :nth-child() for uniqueness
			if (matchingSiblings.length > 1) {
				const index = siblings.indexOf(currentElement) + 1
				selector = `${baseSelector}:nth-child(${index})`
			} else {
				selector = baseSelector
			}
		} else {
			selector = baseSelector
		}

		path.unshift(selector)
		current = parentElement
	}

	return path.join(" > ")
}
