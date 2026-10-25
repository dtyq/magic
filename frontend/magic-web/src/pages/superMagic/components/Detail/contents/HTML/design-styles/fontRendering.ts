const GENERIC_FAMILIES = new Set([
	"cursive",
	"fantasy",
	"inherit",
	"initial",
	"monospace",
	"sans-serif",
	"serif",
	"system-ui",
	"ui-monospace",
	"ui-rounded",
	"ui-sans-serif",
	"unset",
])

function splitFontStack(value: string) {
	const families: string[] = []
	let buffer = ""
	let quote: string | undefined

	for (const character of value) {
		if ((character === "'" || character === '"') && (!quote || quote === character)) {
			quote = quote ? undefined : character
			buffer += character
			continue
		}
		if (character === "," && !quote) {
			if (buffer.trim()) families.push(buffer.trim())
			buffer = ""
			continue
		}
		buffer += character
	}

	if (buffer.trim()) families.push(buffer.trim())
	return families
}

function stripQuotes(value: string) {
	return value.trim().replace(/^['"]|['"]$/g, "")
}

export function parseFontFamilyStack(value: unknown) {
	if (typeof value !== "string") return []
	return splitFontStack(value).map(stripQuotes).filter(Boolean)
}

export function getPrimaryFontFamily(value: unknown) {
	return parseFontFamilyStack(value).find((family) => !GENERIC_FAMILIES.has(family.toLowerCase()))
}
