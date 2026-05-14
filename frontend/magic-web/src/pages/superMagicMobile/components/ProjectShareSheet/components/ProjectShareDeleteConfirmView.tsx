import { useTranslation } from "react-i18next"
import type { ProjectShareSheetController } from "../types"

interface ProjectShareDeleteConfirmViewProps {
	controller: ProjectShareSheetController
}

/**
 * 删除确认页只负责说明风险；确认动作由 Header 右上角按钮承接，贴合原型交互。
 */
export default function ProjectShareDeleteConfirmView({
	controller,
}: ProjectShareDeleteConfirmViewProps) {
	const { t } = useTranslation("super")
	const shareName = controller.selectedShare?.title || t("share.untitled")

	return (
		<div
			className="min-h-32 px-3.5 pt-3 text-[16px] leading-6 text-muted-foreground"
			data-testid="project-share-sheet-delete-confirm-view"
		>
			{t("projectShare.deleteConfirmMessage", { name: shareName })}
		</div>
	)
}
