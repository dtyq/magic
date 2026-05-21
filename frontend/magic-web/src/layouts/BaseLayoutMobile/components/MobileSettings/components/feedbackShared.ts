import type { LucideIcon } from "lucide-react"

/** Maximum number of image attachments per feedback ticket (aligned with prototype). */
export const MOBILE_SETTINGS_FEEDBACK_ATTACHMENT_MAX_COUNT = 4

/** Per-file size cap for feedback attachments (10MB, aligned with prototype). */
export const MOBILE_SETTINGS_FEEDBACK_FILE_MAX_BYTES = 10 * 1024 * 1024

/** Minimum trimmed description length required before submit. */
export const MOBILE_SETTINGS_FEEDBACK_CONTENT_MIN_LENGTH = 10

export const MOBILE_SETTINGS_FEEDBACK_TITLE_MAX_LENGTH = 60

export const MOBILE_SETTINGS_FEEDBACK_DESCRIPTION_MAX_LENGTH = 1000

/** File input accept list — images only until the feedback API supports more types. */
export const MOBILE_SETTINGS_FEEDBACK_ACCEPT = "image/*"

/** 单条反馈分类：展示文案 label 由 useMobileSettingsFeedbackCategories 内 t("…") 字面量组装。 */
export interface MobileSettingsFeedbackCategoryOption {
	id: string
	label: string
	submitValue: string
	Icon: LucideIcon
	iconClassName: string
	iconBoxClassName: string
}
