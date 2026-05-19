import type { TFunction } from "i18next"
import { userStore } from "@/models/user"

interface GenerateShareMessageTextParams {
	fileCount: number
	mainFileName: string
	projectName?: string
	shareProject?: boolean
	shareUrl: string
	fileDisplayConfig?: { type?: string; [key: string]: unknown }
	t: TFunction<"super", undefined>
}

/**
 * 生成分享信息文本
 * 与 ShareSuccessModal 中的逻辑保持一致
 */
export function generateShareMessageText(params: GenerateShareMessageTextParams): string {
	const { fileCount, mainFileName, projectName, shareProject, shareUrl, fileDisplayConfig, t } =
		params

	const lines: string[] = []

	// 优先检查特殊项目类型（不受 fileCount 限制）
	const fileType = fileDisplayConfig?.type
	const isSpecialProject =
		fileType === "audio" ||
		fileType === "dashboard" ||
		fileType === "design" ||
		fileType === "slide" ||
		fileType === "custom"

	if (shareProject) {
		// 项目分享 - 优先使用 projectName，否则使用 shareName
		const displayProjectName = projectName || t("common.untitledProject")
		lines.push(t("share.shareMessageProject"))
		lines.push(t("share.shareMessageProjectName", { projectName: displayProjectName }))
		lines.push(t("share.shareMessageProjectLink", { shareUrl }))
		lines.push(t("share.shareMessageProjectTip"))
	} else if (isSpecialProject) {
		// 特殊项目分享（audio/dashboard/design/slide/custom）- 不限制文件数
		if (fileType === "audio") {
			lines.push(t("share.shareMessageAudio"))
		} else if (fileType === "dashboard") {
			lines.push(t("share.shareMessageDashboard"))
		} else if (fileType === "design") {
			lines.push(t("share.shareMessageDesign"))
		} else if (fileType === "slide") {
			lines.push(t("share.shareMessageSlide"))
		} else if (fileType === "custom") {
			lines.push(t("share.shareMessageCustom"))
		}

		lines.push(t("share.shareMessageSingleFileFile", { fileName: mainFileName }))
		lines.push(t("share.shareMessageSingleFileLink", { shareUrl }))
		lines.push(t("share.shareMessageSingleFileTip"))
	} else if (fileCount === 1) {
		// 单个普通文件分享
		lines.push(t("share.shareMessageSingleFile"))
		lines.push(t("share.shareMessageSingleFileFile", { fileName: mainFileName }))
		lines.push(t("share.shareMessageSingleFileLink", { shareUrl }))
		lines.push(t("share.shareMessageSingleFileTip"))
	} else {
		// 多个文件分享
		lines.push(t("share.shareMessageMultipleFiles", { count: fileCount }))
		lines.push(t("share.shareMessageMultipleFilesLink", { shareUrl }))
		lines.push(t("share.shareMessageMultipleFilesTip"))
	}

	const displayName =
		userStore.user.userInfo?.nickname || userStore.user.userInfo?.real_name || ""
	lines.push(
		t("share.createdBy.footerLine", {
			brand: t("share.createdBy.brand"),
			username: displayName,
		}),
	)

	return lines.join("\n")
}
