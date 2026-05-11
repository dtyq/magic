import type { EmbedFontInput } from "../../../../../packages/html2pptx/src"

export interface PptFontFaceEntry {
	path: string
	weight: number
	style: string
	embeddable?: boolean
	editable?: boolean
}

export interface PptFontEntry {
	id?: string
	typeface: string
	aliases?: string[]
	embeddable?: boolean
	editable?: boolean
	faces: Record<string, PptFontFaceEntry>
}

export interface PptFontManifest {
	version: string
	fonts: PptFontEntry[]
}

export type FontSlot = Exclude<keyof EmbedFontInput, "typeface">
export type FontStyle = "normal" | "italic"

export interface ParsedFaceKey {
	key: string
	weight: number
	style: FontStyle
}

export interface FontSlotRule {
	slot: FontSlot
	fallbackKey: string
	idealWeight: number
	matches: (faceKey: ParsedFaceKey) => boolean
}

export interface SelectedFontFace {
	key: string
	face: PptFontFaceEntry
}

export interface LoadedFontSlot {
	slot: FontSlot
	buffer: ArrayBuffer
}
