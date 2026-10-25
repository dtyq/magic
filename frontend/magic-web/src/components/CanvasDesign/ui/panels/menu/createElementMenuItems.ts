import { Film, Mic, Type } from "lucide-react"
import { ImageSparkles } from "../../primitives/icons"
import type { MenuItem } from "./types"

export type CreateElementMenuKind =
	"text" | "image-generator" | "video-generator" | "audio-generator"

interface CreateElementMenuTranslationKeys {
	text: string
	imageGenerator: string
	videoGenerator: string
	audioGenerator: string
}

interface CreateElementMenuItemsOptions {
	translate: (key: string, fallback: string) => string
	onSelect: (kind: CreateElementMenuKind) => void
	idPrefix: string
	translationKeys?: Partial<CreateElementMenuTranslationKeys>
	fallbacks?: Partial<Record<keyof CreateElementMenuTranslationKeys, string>>
}

const DEFAULT_TRANSLATION_KEYS: CreateElementMenuTranslationKeys = {
	text: "tools.text",
	imageGenerator: "tools.imageGenerator",
	videoGenerator: "tools.videoGenerator",
	audioGenerator: "tools.audioGenerator",
}

export function getCreateElementMenuItems({
	translate,
	onSelect,
	idPrefix,
	translationKeys,
	fallbacks,
}: CreateElementMenuItemsOptions): MenuItem[] {
	const keys = { ...DEFAULT_TRANSLATION_KEYS, ...translationKeys }
	const labels = {
		text: fallbacks?.text ?? "文本",
		imageGenerator: fallbacks?.imageGenerator ?? "图片生成",
		videoGenerator: fallbacks?.videoGenerator ?? "视频生成",
		audioGenerator: fallbacks?.audioGenerator ?? "音频生成",
	}

	return [
		{
			id: `${idPrefix}-text`,
			label: translate(keys.text, labels.text),
			icon: Type,
			onClick: () => onSelect("text"),
		},
		{
			id: `${idPrefix}-image-generator`,
			label: translate(keys.imageGenerator, labels.imageGenerator),
			icon: ImageSparkles,
			onClick: () => onSelect("image-generator"),
		},
		{
			id: `${idPrefix}-video-generator`,
			label: translate(keys.videoGenerator, labels.videoGenerator),
			icon: Film,
			onClick: () => onSelect("video-generator"),
		},
		{
			id: `${idPrefix}-audio-generator`,
			label: translate(keys.audioGenerator, labels.audioGenerator),
			icon: Mic,
			onClick: () => onSelect("audio-generator"),
		},
	]
}
