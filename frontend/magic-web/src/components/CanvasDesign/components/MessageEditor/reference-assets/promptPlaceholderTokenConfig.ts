import type { TFunction } from "../../../context/I18nContext"
import {
	decodePromptPlaceholdersToMentions,
	type PromptPlaceholderReference,
} from "./promptPlaceholderCodec"

export interface PromptPlaceholderTokenConfig {
	imageLabel: string
	videoLabel: string
	audioLabel: string
	leftWrapper: string
	rightWrapper: string
}

export type PromptPlaceholderTokenKind = "image" | "video" | "audio"

export interface PromptPlaceholderTokenMatch {
	kind: PromptPlaceholderTokenKind
	label: string
	index: number
	rawText: string
	start: number
	end: number
}

const PROMPT_PLACEHOLDER_DECODE_LABELS: Record<PromptPlaceholderTokenKind, string[]> = {
	image: ["图片", "Image"],
	video: ["视频", "Video"],
	audio: ["音频", "Audio"],
}

const PROMPT_PLACEHOLDER_LEFT_WRAPPER = "["
const PROMPT_PLACEHOLDER_RIGHT_WRAPPER = "]"

function normalize(value: string | undefined, fallback: string): string {
	const normalized = value?.trim()
	return normalized || fallback
}

function escapeRegex(value: string): string {
	return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

export function resolvePromptPlaceholderTokenConfig(t: TFunction): PromptPlaceholderTokenConfig {
	return {
		imageLabel: normalize(
			t("videoEditor.promptPlaceholderReferenceImageTokenLabel", "图片"),
			"图片",
		),
		videoLabel: normalize(
			t("videoEditor.promptPlaceholderReferenceVideoTokenLabel", "视频"),
			"视频",
		),
		audioLabel: normalize(
			t("videoEditor.promptPlaceholderReferenceAudioTokenLabel", "音频"),
			"音频",
		),
		leftWrapper: PROMPT_PLACEHOLDER_LEFT_WRAPPER,
		rightWrapper: PROMPT_PLACEHOLDER_RIGHT_WRAPPER,
	}
}

export function createPromptPlaceholderTokenFactory(
	label: string,
	config: PromptPlaceholderTokenConfig,
) {
	const tokenLabel = normalize(label, config.imageLabel)
	const left = normalize(config.leftWrapper, "[")
	const right = normalize(config.rightWrapper, "]")
	return (index: number) => `${left}${tokenLabel}${index}${right}`
}

export function resolvePromptPlaceholderDecodeLabels(
	kind: PromptPlaceholderTokenKind,
	config: PromptPlaceholderTokenConfig,
): string[] {
	const currentLabel =
		kind === "image"
			? config.imageLabel
			: kind === "video"
				? config.videoLabel
				: config.audioLabel
	const defaults = PROMPT_PLACEHOLDER_DECODE_LABELS[kind]
	return Array.from(
		new Set([currentLabel, ...defaults].map((item) => item.trim()).filter(Boolean)),
	)
}

export function parsePromptPlaceholderTokenMatches(
	prompt: string,
	config: PromptPlaceholderTokenConfig,
): PromptPlaceholderTokenMatch[] {
	if (!prompt) return []

	const labelEntries = (["image", "video", "audio"] as const).flatMap((kind) =>
		resolvePromptPlaceholderDecodeLabels(kind, config).map((label) => ({ kind, label })),
	)
	if (labelEntries.length === 0) return []

	const sortedEntries = Array.from(
		new Map(labelEntries.map((entry) => [`${entry.kind}:${entry.label}`, entry])).values(),
	).sort((left, right) => right.label.length - left.label.length)
	const leftWrapper = escapeRegex(normalize(config.leftWrapper, "["))
	const rightWrapper = escapeRegex(normalize(config.rightWrapper, "]"))
	const labelPattern = sortedEntries.map((entry) => escapeRegex(entry.label)).join("|")
	if (!labelPattern) return []

	const placeholderPattern = new RegExp(
		`${leftWrapper}(${labelPattern})(\\d+)${rightWrapper}`,
		"g",
	)
	const matches: PromptPlaceholderTokenMatch[] = []
	let match: RegExpExecArray | null = placeholderPattern.exec(prompt)

	while (match) {
		const label = match[1]
		const kind = sortedEntries.find((entry) => entry.label === label)?.kind
		const index = Number(match[2])
		if (kind && Number.isInteger(index) && index > 0) {
			matches.push({
				kind,
				label,
				index,
				rawText: match[0],
				start: match.index,
				end: match.index + match[0].length,
			})
		}
		match = placeholderPattern.exec(prompt)
	}

	return matches
}

export function decodePromptPlaceholdersWithLabels(
	prompt: string,
	references: PromptPlaceholderReference[],
	labels: string[],
	config: PromptPlaceholderTokenConfig,
): string {
	if (!prompt || labels.length === 0 || references.length === 0) return prompt

	const left = normalize(config.leftWrapper, "[")
	const right = normalize(config.rightWrapper, "]")
	let decoded = prompt

	for (const label of labels) {
		decoded = decodePromptPlaceholdersToMentions(decoded, references, {
			buildToken: (index: number) => `${left}${label}${index}${right}`,
		})
	}

	// 兼容旧数据：显式解析并归一化 @xxx.png 这类 mention 文本。
	for (const reference of references) {
		const fileName = reference.fileName?.trim()
		if (!fileName) continue
		const escapedFileName = fileName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
		decoded = decoded.replace(new RegExp(`@${escapedFileName}`, "gi"), `@${fileName}`)
	}

	return decoded
}
