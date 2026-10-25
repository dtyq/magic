import type { JSONContent } from "@/infrastructure/editors/tiptap/core"
import type { SelfMediaPlatform } from "@/pages/superMagic/components/Detail/types"
import {
	getDefaultCardCount,
	getVisualPresetsForPlatform,
} from "@/pages/superMagic/components/Detail/components/SelfMediaRootRender/components/SelfMediaInitPanel/types"
import { ScenePanelVariant } from "../components/LazyScenePanel/types"
import { SPECIALIZED_COMPOSER_MIN_INPUT_HEIGHT } from "../../ConversationInputResize/constants"

export const SELF_MEDIA_COMPOSER_TOPIC_PATTERN = "ip-manager"
/** Reserve enough vertical space for the editor and the self-media configuration trigger. */
export const SELF_MEDIA_COMPOSER_MIN_INPUT_HEIGHT = SPECIALIZED_COMPOSER_MIN_INPUT_HEIGHT
export const SELF_MEDIA_CARD_COUNT_PRESETS = [3, 6, 9, 12] as const
export const SELF_MEDIA_CUSTOM_CARD_COUNT = "custom"
export const SELF_MEDIA_CARD_COUNT_MIN = 1
export const SELF_MEDIA_CARD_COUNT_MAX = 20

export type SelfMediaCardCountMode =
	`${(typeof SELF_MEDIA_CARD_COUNT_PRESETS)[number]}` | typeof SELF_MEDIA_CUSTOM_CARD_COUNT

export interface SelfMediaComposerConfigValue {
	platform?: SelfMediaPlatform
	visualPreset?: string
	cardCount?: number
}

export interface SelfMediaComposerConfigLabels {
	platform?: string
	visualPreset?: string
	cardCount?: string
}

export interface ResolveCardCountOptions {
	mode: SelfMediaCardCountMode
	customValue: string
	platform: SelfMediaPlatform
}

interface SelfMediaComposerContextLike {
	topicMode?: string
	agentCode?: string
	selectedTopic?: {
		agent_code?: string | null
	} | null
}

const DEFAULT_SELF_MEDIA_COMPOSER_CONFIG_LABELS: Required<SelfMediaComposerConfigLabels> = {
	platform: "platform",
	visualPreset: "visualPreset",
	cardCount: "cardCount",
}

export function getDefaultSelfMediaComposerConfig(): Required<SelfMediaComposerConfigValue> {
	const platform: SelfMediaPlatform = "rednote"

	return {
		platform,
		visualPreset: resolveSelfMediaVisualPreset(platform),
		cardCount: getDefaultCardCount(platform),
	}
}

export function getSelfMediaPlatformOptions() {
	return [
		{ value: "rednote", label: "小红书" },
		{ value: "instagram", label: "Instagram" },
		{ value: "wechat-official-accounts", label: "微信公众号" },
	] satisfies Array<{ value: SelfMediaPlatform; label: string }>
}

export function platformSupportsCardCount(platform: SelfMediaPlatform): boolean {
	return platform !== "wechat-official-accounts"
}

export function resolveSelfMediaVisualPreset(
	platform: SelfMediaPlatform,
	currentValue?: string,
): string {
	const presets = getVisualPresetsForPlatform(platform)
	if (currentValue && presets.some((preset) => preset.value === currentValue)) {
		return currentValue
	}

	return presets[0]?.value ?? "custom"
}

export function resolveSelfMediaCardCount({
	mode,
	customValue,
	platform,
}: ResolveCardCountOptions): number {
	if (!platformSupportsCardCount(platform)) return 0
	if (mode !== SELF_MEDIA_CUSTOM_CARD_COUNT) return Number(mode)

	const parsedValue = Number.parseInt(customValue, 10)
	const fallback = getDefaultCardCount(platform) || 6
	if (!Number.isFinite(parsedValue)) return fallback

	return Math.min(SELF_MEDIA_CARD_COUNT_MAX, Math.max(SELF_MEDIA_CARD_COUNT_MIN, parsedValue))
}

export function buildSelfMediaComposerPresetContent(
	{ platform, visualPreset, cardCount }: SelfMediaComposerConfigValue,
	labels: SelfMediaComposerConfigLabels = {},
): JSONContent | undefined {
	const fieldLabels = { ...DEFAULT_SELF_MEDIA_COMPOSER_CONFIG_LABELS, ...labels }
	const segments = [
		...(platform ? [`${fieldLabels.platform}: ${platform}`] : []),
		...(visualPreset ? [`${fieldLabels.visualPreset}: ${visualPreset}`] : []),
	]

	if ((!platform || platformSupportsCardCount(platform)) && typeof cardCount === "number") {
		segments.push(`${fieldLabels.cardCount}: ${cardCount}`)
	}

	if (segments.length === 0) return undefined

	return {
		type: "doc",
		content: [
			{
				type: "paragraph",
				content: [{ type: "text", text: `${segments.join("; ")}.` }],
			},
		],
	}
}

export function isSelfMediaComposerContext(context?: SelfMediaComposerContextLike): boolean {
	if (!context) return false

	return [context.topicMode, context.agentCode, context.selectedTopic?.agent_code].some(
		(value) => value === SELF_MEDIA_COMPOSER_TOPIC_PATTERN,
	)
}

export function shouldShowSelfMediaComposerConfigPanel({
	context,
	hasSelectedScene,
	hasAvailableScenes,
	variant,
}: {
	context?: SelfMediaComposerContextLike
	hasSelectedScene: boolean
	hasAvailableScenes?: boolean
	variant?: ScenePanelVariant
}): boolean {
	if (variant === ScenePanelVariant.Mobile) return false
	if (!isSelfMediaComposerContext(context)) return false

	return hasSelectedScene || hasAvailableScenes === false
}
