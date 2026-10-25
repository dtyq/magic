import type { MediaSourceDescriptor } from "../media/source-descriptor"

/**
 * Public font contracts: consumers provide font download/embedding through fontResolver.
 * This package only detects which fonts are used; it does not fetch or load fonts.
 *
 * Font faces use the same descriptor protocol as other PptxGenJS media inputs. Keeping
 * the descriptor at this boundary lets the streaming Worker transfer bytes safely and
 * prevents the packaging layer from passing legacy ArrayBuffers to embedFont().
 */

export interface EmbedFontInput {
	typeface: string
	regular?: MediaSourceDescriptor
	bold?: MediaSourceDescriptor
	italic?: MediaSourceDescriptor
	boldItalic?: MediaSourceDescriptor
}

export type FontMissPolicy = "fallback-with-warning" | "no-embed" | "fail"

export interface UsedFont {
	typeface: string
	faceKeys: string[]
}

export interface FontResolverContext {
	missPolicy: FontMissPolicy
}

export type FontResolver = (
	usedFonts: UsedFont[],
	context: FontResolverContext,
) => EmbedFontInput[] | Promise<EmbedFontInput[]> | void | Promise<void>
