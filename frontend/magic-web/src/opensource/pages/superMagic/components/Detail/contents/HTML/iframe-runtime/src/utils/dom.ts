/**
 * DOM utility functions
 */

/**
 * Get unique selector for an element
 */
export function getElementSelector(element: HTMLElement): string {
	if (!element || element.nodeType !== Node.ELEMENT_NODE) {
		return ""
	}

	if (element === document.documentElement) {
		return "html"
	}

	if (element === document.body) {
		return "body"
	}

	const path: string[] = []
	let current: HTMLElement | null = element

	while (
		current &&
		current.nodeType === Node.ELEMENT_NODE &&
		current !== document.documentElement &&
		current !== document.body
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

		// Keep selector semantics aligned with actual CSS matching.
		// If there are same-tag siblings, add :nth-of-type() to avoid
		// class-subset collisions such as `.card.a.b` matching siblings
		// with extra classes.
		const parentElement: HTMLElement | null = currentElement.parentElement
		if (parentElement) {
			const sameTagSiblings = Array.from(parentElement.children).filter(
				(child) => child.tagName.toLowerCase() === currentElement.tagName.toLowerCase(),
			)

			if (sameTagSiblings.length > 1) {
				const index = sameTagSiblings.indexOf(currentElement) + 1
				selector = `${baseSelector}:nth-of-type(${index})`
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

/**
 * Check if element is injected by editor
 */
export function isInjectedElement(element: Element): boolean {
	if (element.getAttribute("data-injected") === "true") return true
	if (element.closest('[data-injected="true"]')) return true
	return false
}
