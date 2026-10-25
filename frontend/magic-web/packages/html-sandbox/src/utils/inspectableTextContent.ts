/** Tags whose inner text is fallback/replaced content, not user-authored copy. */
export const NON_TEXTUAL_ELEMENT_TAGS = new Set([
	"area",
	"audio",
	"base",
	"br",
	"canvas",
	"col",
	"embed",
	"hr",
	"iframe",
	"img",
	"input",
	"link",
	"meta",
	"noscript",
	"object",
	"param",
	"source",
	"track",
	"video",
	"wbr",
])

export function isNonTextualElementTag(tagName: string): boolean {
	return NON_TEXTUAL_ELEMENT_TAGS.has(tagName.toLowerCase())
}

function isSkippedTextHost(element: Element, root: Element): boolean {
	let current: Element | null = element
	while (current && current !== root) {
		if (isNonTextualElementTag(current.tagName)) return true
		current = current.parentElement
	}
	return false
}

function normalizeInspectableText(value: string): string {
	return value.replace(/\s+/g, " ").trim()
}

/** Text shown when inspecting/selecting an element for AI editing. */
export function getInspectableTextContent(element: Element): string {
	if (isNonTextualElementTag(element.tagName)) return ""

	const ownerDocument = element.ownerDocument
	if (!ownerDocument) return normalizeInspectableText(element.textContent || "")

	let raw = ""
	const walker = ownerDocument.createTreeWalker(element, NodeFilter.SHOW_TEXT)
	let node = walker.nextNode()
	while (node) {
		const textNode = node as Text
		const parent = textNode.parentElement
		if (parent && !isSkippedTextHost(parent, element)) {
			raw += textNode.textContent || ""
		}
		node = walker.nextNode()
	}

	return normalizeInspectableText(raw)
}

/** Browser-executable copy for iframe-injected inspector scripts. */
export const INSPECTABLE_TEXT_CONTENT_SCRIPT = `
function isNonTextualElementTag(tagName) {
	return [
		"area","audio","base","br","canvas","col","embed","hr","iframe","img",
		"input","link","meta","noscript","object","param","source","track","video","wbr"
	].indexOf(String(tagName).toLowerCase()) !== -1;
}
function isSkippedTextHost(element, root) {
	var current = element;
	while (current && current !== root) {
		if (isNonTextualElementTag(current.tagName)) return true;
		current = current.parentElement;
	}
	return false;
}
function normalizeInspectableText(value) {
	return String(value || "").replace(/\\s+/g, " ").trim();
}
function getInspectableTextContent(element) {
	if (!element) return "";
	if (isNonTextualElementTag(element.tagName)) return "";
	var ownerDocument = element.ownerDocument;
	if (!ownerDocument) return normalizeInspectableText(element.textContent || "");
	var raw = "";
	var walker = ownerDocument.createTreeWalker(element, NodeFilter.SHOW_TEXT);
	var node = walker.nextNode();
	while (node) {
		var parent = node.parentElement;
		if (parent && !isSkippedTextHost(parent, element)) {
			raw += node.textContent || "";
		}
		node = walker.nextNode();
	}
	return normalizeInspectableText(raw);
}
`
