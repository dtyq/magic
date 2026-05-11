import { DownloadImageMode } from "@/pages/superMagic/pages/Workspace/types"
import { userStore } from "@/models/user"
import { Admin } from "@/types/admin"
import { isInternationalEnv } from "@/utils/env"
import {
	getCachedAiWatermarkPreference,
	isAiWatermarkAgreementEnabled,
} from "@/utils/aiWatermarkPreferenceCache"

/**
 * 走 get-file-url 时：全局无水印协议生效且具备权益则带 download_mode（预览与 is_download 下载共用），仍使用 get-file-url（非 high-quality 接口）。
 */
export function getFileUrlDownloadModeForNoWatermark(): DownloadImageMode | undefined {
	if (isInternationalEnv()) return undefined

	const { organizationSubscriptionInfo } = userStore.user
	const isFreeTrialVersion =
		organizationSubscriptionInfo?.plan_type === Admin.PlanType.Personal
			? !organizationSubscriptionInfo?.is_paid_plan
			: false
	if (isFreeTrialVersion) return undefined

	const cached = getCachedAiWatermarkPreference()
	if (!isAiWatermarkAgreementEnabled(cached)) return undefined

	return DownloadImageMode.Download
}

/** 与 getTemporaryDownloadUrl 自动注入 download_mode 一致，用于设计文件换链缓存失效判断 */
export function getPreviewFileUrlWatermarkSignature(): string {
	const mode = getFileUrlDownloadModeForNoWatermark()
	if (mode === undefined) return "watermark_preview"
	return mode
}
