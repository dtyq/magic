import type { SkillI18nText } from "@/opensource/apis/modules/skills"
import { SupportLocales } from "@/opensource/constants/locale"

export interface UploadedFile {
	file: File
	progress: number
	status: "uploading" | "done" | "error"
}

export function createEmptySkillI18nText(): SkillI18nText {
	return {
		[SupportLocales.fallback]: "",
		[SupportLocales.enUS]: "",
		[SupportLocales.zhCN]: "",
	}
}

export function normalizeSkillI18nText(
	value?: Record<string, string> | null,
	fallbackText = "",
): SkillI18nText {
	return {
		[SupportLocales.fallback]: value?.[SupportLocales.fallback] || fallbackText,
		[SupportLocales.enUS]: value?.[SupportLocales.enUS] || "",
		[SupportLocales.zhCN]: value?.[SupportLocales.zhCN] || "",
	}
}

export function createInitialSkillIdentityData(): SkillIdentityData {
	return {
		iconUrl: undefined,
		name: createEmptySkillI18nText(),
		description: createEmptySkillI18nText(),
	}
}

export interface SkillIdentityData {
	iconUrl?: string
	/** Raw File object when user picks a new icon; undefined if unchanged */
	iconFile?: File
	name: SkillI18nText
	description: SkillI18nText
}

export type LocalizeField = "name" | "description"
