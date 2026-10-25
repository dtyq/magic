const PLACEHOLDER = /\{\{\s*([A-Za-z0-9_]+)\s*\}\}/g

export interface NotificationTemplatePart {
	text: string
	field?: string
	offset: number
}

export function renderTemplateParts(template: string, payload: Record<string, unknown>) {
	const parts: NotificationTemplatePart[] = []
	let cursor = 0
	for (const match of template.matchAll(PLACEHOLDER)) {
		const offset = match.index!
		if (offset > cursor) {
			parts.push({ text: template.slice(cursor, offset), offset: cursor })
		}
		const field = match[1]
		const value = payload[field]
		parts.push({
			text: value == null || value === "" ? "-" : String(value),
			field,
			offset,
		})
		cursor = offset + match[0].length
	}
	if (cursor < template.length) {
		parts.push({ text: template.slice(cursor), offset: cursor })
	}
	return parts
}

export function renderTemplate(template: string, payload: Record<string, unknown>) {
	return renderTemplateParts(template, payload)
		.map((part) => part.text)
		.join("")
}

export function templateCatalogKey(type: string, version: number) {
	return `${type}:${version}`
}
