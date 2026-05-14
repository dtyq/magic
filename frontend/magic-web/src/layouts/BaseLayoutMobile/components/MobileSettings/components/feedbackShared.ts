import type { LucideIcon } from "lucide-react"

export const MOBILE_SETTINGS_FEEDBACK_IMAGE_MAX_COUNT = 10
export const MOBILE_SETTINGS_FEEDBACK_IMAGE_MAX_SIZE_BYTES = 2 * 1024 * 1024
export const MOBILE_SETTINGS_FEEDBACK_TITLE_MAX_LENGTH = 60
export const MOBILE_SETTINGS_FEEDBACK_DESCRIPTION_MAX_LENGTH = 1000

/** 单条反馈分类：展示文案 label 由 useMobileSettingsFeedbackCategories 内 t("…") 字面量组装。 */
export interface MobileSettingsFeedbackCategoryOption {
	id: string
	label: string
	submitValue: string
	Icon: LucideIcon
	iconClassName: string
	iconBoxClassName: string
}
