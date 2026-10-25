/**
 * Remove document links that could execute browser-controlled schemes.
 * docx-preview copies external relationship targets directly to `href`, so
 * untrusted DOCX files are limited to HTTP(S) URLs and in-document anchors.
 */
export function sanitizeDocxPreviewLinks(container: ParentNode): void {
	const links = container.querySelectorAll<HTMLAnchorElement>("a[href]")

	links.forEach((link) => {
		const href = link.getAttribute("href")?.trim() ?? ""

		// Fragment links are used for internal Word bookmarks.
		if (!href || href.startsWith("#")) return

		try {
			const protocol = new URL(href, window.location.href).protocol
			if (protocol === "http:" || protocol === "https:") return
		} catch {
			// Invalid URLs are treated as unsupported schemes below.
		}

		// Preserve the rendered text while making the unsafe target inert.
		link.removeAttribute("href")
	})
}
