/** Preview-only wrappers must never be persisted into the user's HTML. */
export function restoreLocationHref(source: string): string {
	return source.replace(
		/\/\*__MAGIC_LOCATION_START__:(.*?)__\*\/[\s\S]*?\/\*__MAGIC_LOCATION_END__\*\//g,
		(match, original: string) => {
			try {
				return decodeURIComponent(original)
			} catch {
				return match
			}
		},
	)
}

export function restoreHtmlLocationHref(doc: Document): void {
	doc.querySelectorAll("script:not([src])").forEach((script) => {
		script.textContent = restoreLocationHref(script.textContent || "")
	})
	// Restore decoded attribute values, not serialized HTML: quotes in bracket
	// notation must be escaped again by the DOM serializer.
	doc.querySelectorAll("*").forEach((element) => {
		for (const attribute of Array.from(element.attributes)) {
			if (!attribute.name.startsWith("on")) continue
			element.setAttribute(attribute.name, restoreLocationHref(attribute.value))
		}
	})
}
