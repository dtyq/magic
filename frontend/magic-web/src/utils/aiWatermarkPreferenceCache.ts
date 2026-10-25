import {
	getCachedPersonalPreferences,
	getPersonalPreferencesUserKey,
	setCachedPersonalPreferences,
	type PersonalPreferencesValue,
} from "@/utils/personalPreferencesCache"

/** 兼容既有 AI 水印调用方的用户缓存键导出。 */
export const getAiWatermarkPreferenceUserKey = getPersonalPreferencesUserKey

/** 兼容既有 AI 水印调用方的缓存读取导出。 */
export const getCachedAiWatermarkPreference = getCachedPersonalPreferences

/** 兼容既有 AI 水印调用方的缓存写入导出。 */
export const setCachedAiWatermarkPreference = setCachedPersonalPreferences

export function isAiWatermarkAgreementEnabled(value?: PersonalPreferencesValue | null) {
	return value?.add_ai_watermark === false
}

export type { PersonalPreferencesValue }
