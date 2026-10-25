export function isRootHtmlXhtmlNamespace(attr: Attr): boolean {
	return attr.name === "xmlns" && attr.value === "http://www.w3.org/1999/xhtml"
}

/** Remove the root XHTML declaration while retaining nested SVG/foreignObject namespaces. */
export function removeRootHtmlXhtmlNamespace(html: string): string {
	if (!html || typeof html !== "string") return html

	return html.replace(/<html\b([^>]*)>/i, (match, attrs = "") => {
		const cleanedAttrs = attrs.replace(
			/\s+xmlns=(["'])http:\/\/www\.w3\.org\/1999\/xhtml\1/i,
			"",
		)
		return `<html${cleanedAttrs}>`
	})
}

/**
 * Use HTML serialization for elements: it escapes text/attributes but preserves raw script/style.
 * Decoding an XML-serialized document wholesale turns escaped code examples into real markup.
 * XML serialization is only needed for document-level DOCTYPE and comments, outside raw-text tags.
 */
export function serializeHtmlDocument(doc: Document): string {
	const serializer = new XMLSerializer()
	return Array.from(doc.childNodes, (node) =>
		node.nodeType === Node.ELEMENT_NODE
			? removeRootHtmlXhtmlNamespace((node as Element).outerHTML)
			: serializer.serializeToString(node),
	).join("")
}
