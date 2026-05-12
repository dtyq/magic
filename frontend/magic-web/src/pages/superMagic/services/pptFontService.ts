import type {
	EmbedFontInput,
	FontMissPolicy,
	FontResolver,
	UsedFont,
} from "../../../../packages/html2pptx/src"
import { loadFontSlots, handleFontIssue } from "./pptFont/loader"
import { findFontEntry } from "./pptFont/matcher"
import { loadPptFontManifest } from "./pptFont/manifest"
import type { PptFontEntry } from "./pptFont/types"
import { getPptFontBaseUrl } from "./pptFont/url"

export { getPptFontBaseUrl } from "./pptFont/url"

export const pptFontResolver: FontResolver = async (usedFonts, { missPolicy }) =>
	resolvePptEmbedFonts(usedFonts, missPolicy)

export async function resolvePptEmbedFonts(
	usedFonts: UsedFont[],
	missPolicy: FontMissPolicy = "fallback-with-warning",
): Promise<EmbedFontInput[]> {
	if (usedFonts.length === 0) return []

	const manifest = await loadPptFontManifest()
	const fontBaseUrl = getPptFontBaseUrl()
	const result: EmbedFontInput[] = []

	for (const usedFont of usedFonts) {
		const entry = findFontEntry(manifest, usedFont.typeface)

		if (!entry) {
			handleFontIssue(
				`[pptFont] Font not found in manifest: "${usedFont.typeface}"`,
				missPolicy,
			)
			continue
		}

		if (entry.embeddable === false || entry.editable === false) {
			handleFontIssue(`[pptFont] Font cannot be embedded: "${entry.typeface}"`, missPolicy)
			continue
		}

		const embedFont = await resolveFontFamily(entry, usedFont, fontBaseUrl, missPolicy)
		if (hasLoadedFace(embedFont)) result.push(embedFont)
	}

	return result
}

async function resolveFontFamily(
	entry: PptFontEntry,
	usedFont: UsedFont,
	fontBaseUrl: string,
	missPolicy: FontMissPolicy,
): Promise<EmbedFontInput> {
	const loadedSlots = await loadFontSlots({
		entry,
		faceKeys: usedFont.faceKeys,
		fontBaseUrl,
		missPolicy,
	})

	const input: EmbedFontInput = { typeface: usedFont.typeface }
	for (const loadedSlot of loadedSlots) {
		input[loadedSlot.slot] = loadedSlot.buffer
	}
	return input
}

function hasLoadedFace(input: EmbedFontInput): boolean {
	return Boolean(input.regular || input.bold || input.italic || input.boldItalic)
}
