import {
	PPT_BUILD_AFTER_ATTRIBUTE,
	PPT_BUILD_ATTRIBUTE,
	PPT_BUILD_EFFECT_ATTRIBUTE,
} from "@dtyq/html-sandbox/utils/pptBuild"

const BUILD_ATTRIBUTE_PATTERN = new RegExp(
	`\\s(?:${PPT_BUILD_ATTRIBUTE}|${PPT_BUILD_EFFECT_ATTRIBUTE}|${PPT_BUILD_AFTER_ATTRIBUTE})(?=[\\s=>/])(?:=(?:"[^"]*"|'[^']*'|[^\\s>]+))?`,
	"g",
)

/**
 * Build metadata only matters while presenting. Comparing sources without it lets the
 * preview iframe keep its current document while steps are being authored.
 */
export function stripPPTBuildMetadata(html: string): string {
	return html.replace(BUILD_ATTRIBUTE_PATTERN, "")
}
