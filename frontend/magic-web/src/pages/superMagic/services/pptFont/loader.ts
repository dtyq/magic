import type { FontMissPolicy } from "../../../../../packages/html2pptx/src"
import { FONT_SLOT_RULES, isParsedFaceKey, parseFaceKey, selectFontFace } from "./matcher"
import type { LoadedFontSlot, ParsedFaceKey, PptFontEntry } from "./types"
import { resolvePptFontUrl } from "./url"

const fontBufferCache = new Map<string, Promise<ArrayBuffer>>()

export async function loadFontSlots(input: {
	entry: PptFontEntry
	faceKeys: string[]
	fontBaseUrl: string
	missPolicy: FontMissPolicy
}): Promise<LoadedFontSlot[]> {
	const { entry, faceKeys, fontBaseUrl, missPolicy } = input
	const parsedFaceKeys = faceKeys.map(parseFaceKey).filter(isParsedFaceKey)
	const loadedSlots = await Promise.all(
		FONT_SLOT_RULES.map((rule) =>
			loadFontSlot({
				entry,
				fontBaseUrl,
				missPolicy,
				rule,
				parsedFaceKeys,
			}),
		),
	)

	return loadedSlots.filter(isLoadedFontSlot)
}

async function loadFontSlot(input: {
	entry: PptFontEntry
	rule: (typeof FONT_SLOT_RULES)[number]
	parsedFaceKeys: ParsedFaceKey[]
	fontBaseUrl: string
	missPolicy: FontMissPolicy
}): Promise<LoadedFontSlot | null> {
	const { entry, rule, parsedFaceKeys, fontBaseUrl, missPolicy } = input
	const requestedFaceKeys = parsedFaceKeys.filter(rule.matches)
	if (requestedFaceKeys.length === 0) return null

	const selected = selectFontFace(entry, requestedFaceKeys, rule)
	if (!selected) {
		handleFontIssue(
			`[pptFont] Font face not found: "${entry.typeface}" ${requestedFaceKeys
				.map(({ key }) => key)
				.join(", ")}`,
			missPolicy,
		)
		return null
	}

	const { face, key } = selected
	if (face.embeddable === false || face.editable === false) {
		handleFontIssue(
			`[pptFont] Font face cannot be embedded: "${entry.typeface}" ${key}`,
			missPolicy,
		)
		return null
	}

	const url = resolvePptFontUrl(face.path, fontBaseUrl)
	try {
		return {
			slot: rule.slot,
			buffer: await fetchFontBuffer(url),
		}
	} catch (error) {
		handleFontIssue(
			`[pptFont] Failed to fetch font "${entry.typeface}" ${key}: ${url} (${String(error)})`,
			missPolicy,
		)
		return null
	}
}

async function fetchFontBuffer(url: string): Promise<ArrayBuffer> {
	const cached = fontBufferCache.get(url)
	if (cached) return cached

	const promise = fetch(url)
		.then((response) => {
			if (!response.ok) throw new Error(`HTTP ${response.status}`)
			return response.arrayBuffer()
		})
		.catch((error) => {
			fontBufferCache.delete(url)
			throw error
		})

	fontBufferCache.set(url, promise)
	return promise
}

function isLoadedFontSlot(value: LoadedFontSlot | null): value is LoadedFontSlot {
	return Boolean(value)
}

export function handleFontIssue(message: string, missPolicy: FontMissPolicy): void {
	if (missPolicy === "fail") throw new Error(message)
	if (missPolicy === "fallback-with-warning") console.warn(message)
}
