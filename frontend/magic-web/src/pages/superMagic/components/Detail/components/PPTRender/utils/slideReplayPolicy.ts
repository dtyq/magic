/** Only declarative slides can rewind without re-executing authored JavaScript. */
export function canReplaySlideInPlace(content: string): boolean {
	const doc = new DOMParser().parseFromString(content, "text/html")
	// Event handlers and embedded documents can own state that animation APIs cannot reset.
	if (doc.querySelector("iframe, object, embed, form, input, textarea, select, details"))
		return false
	// 外部 stylesheet／@import 的动画是否能完整重置，由真实 iframe 的 prepare 回执证明。
	// Important authored animation rules can override the temporary reset stylesheet. They
	// retain document replay rather than silently failing to replay a completed entrance.
	for (const element of doc.querySelectorAll("style, [style]")) {
		const css =
			element.tagName === "STYLE"
				? (element.textContent ?? "")
				: (element.getAttribute("style") ?? "")
		const declarations = css.replace(/\/\*[\s\S]*?\*\//g, "")
		if (/animation(?:-[a-z-]+)?\s*:[^;{}]*!\s*important/i.test(declarations)) return false
	}
	for (const element of doc.querySelectorAll("*")) {
		if (element.getAttributeNames().some((name) => /^on/i.test(name))) return false
		// Tailwind can inject important animation rules after this source classification.
		if (Array.from(element.classList).some((name) => /(?:^|:)!animate-/.test(name)))
			return false
	}
	return Array.from(doc.querySelectorAll("script")).every((script) => {
		// Some loaders supply only processed HTML. This specific host polyfill is stateless;
		// arbitrary scripts carrying a generic data-injected marker still require replay.
		if (script.getAttribute("data-injected") === "at-polyfill") return true
		const type = (script.getAttribute("type") ?? "").trim().toLowerCase()
		if (["application/json", "application/ld+json", "importmap"].includes(type)) return true
		if (!script.src && !script.textContent?.trim()) return true
		// Standard deck messaging and Tailwind configure presentation, not an authored timeline.
		const src = script.getAttribute("src") ?? ""
		return (
			/^(?:\.\/)?slide-bridge\.js$/.test(src) ||
			/^https:\/\/cdn\.tailwindcss\.com(?:\/3\.4\.17)?\/?$/.test(src)
		)
	})
}
