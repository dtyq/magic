import type {
	FontSlotRule,
	ParsedFaceKey,
	PptFontEntry,
	PptFontManifest,
	SelectedFontFace,
} from "./types"

export const FONT_SLOT_RULES: FontSlotRule[] = [
	{
		slot: "regular",
		fallbackKey: "400-normal",
		idealWeight: 400,
		matches: ({ weight, style }) => style === "normal" && weight < 600,
	},
	{
		slot: "bold",
		fallbackKey: "700-normal",
		idealWeight: 700,
		matches: ({ weight, style }) => style === "normal" && weight >= 600,
	},
	{
		slot: "italic",
		fallbackKey: "400-italic",
		idealWeight: 400,
		matches: ({ weight, style }) => style === "italic" && weight < 600,
	},
	{
		slot: "boldItalic",
		fallbackKey: "700-italic",
		idealWeight: 700,
		matches: ({ weight, style }) => style === "italic" && weight >= 600,
	},
]

export function findFontEntry(
	manifest: PptFontManifest,
	typeface: string,
): PptFontEntry | undefined {
	const normalizedTypeface = normalizeFontName(typeface)
	return manifest.fonts.find((font) => {
		if (normalizeFontName(font.typeface) === normalizedTypeface) return true
		return font.aliases?.some((alias) => normalizeFontName(alias) === normalizedTypeface)
	})
}

export function parseFaceKey(key: string): ParsedFaceKey | null {
	const match = key.match(/^(\d+)-(normal|italic)$/)
	if (!match) return null
	return {
		key,
		weight: Number(match[1]),
		style: match[2] as ParsedFaceKey["style"],
	}
}

export function isParsedFaceKey(value: ParsedFaceKey | null): value is ParsedFaceKey {
	return Boolean(value)
}

export function selectFontFace(
	entry: PptFontEntry,
	requestedFaceKeys: ParsedFaceKey[],
	rule: FontSlotRule,
): SelectedFontFace | null {
	const sortedFaceKeys = [...requestedFaceKeys].sort((a, b) =>
		compareFaceKeysByIdealWeight(a, b, rule.idealWeight),
	)

	for (const key of sortedFaceKeys) {
		const face = entry.faces[key.key]
		if (face) return { key: key.key, face }
	}

	const fallbackKey = rule.fallbackKey
	const fallbackFace = entry.faces[fallbackKey] ?? entry.faces["400-normal"]
	if (!fallbackFace) return null

	return {
		key: entry.faces[fallbackKey] ? fallbackKey : "400-normal",
		face: fallbackFace,
	}
}

function compareFaceKeysByIdealWeight(
	a: ParsedFaceKey,
	b: ParsedFaceKey,
	idealWeight: number,
): number {
	const aDistance = Math.abs(a.weight - idealWeight)
	const bDistance = Math.abs(b.weight - idealWeight)
	return aDistance - bDistance || a.weight - b.weight
}

function normalizeFontName(name: string): string {
	return name.replace(/['"]/g, "").trim().toLowerCase()
}
