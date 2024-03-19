import { memo, useState, useCallback, useEffect } from "react"
import { useTranslation } from "react-i18next"
import CommonPopup from "@/opensource/pages/superMagicMobile/components/CommonPopup"
import FileSelector from "../FileSelector"
import type { AttachmentItem } from "../../TopicFilesButton/hooks/types"
import { Switch } from "@/opensource/components/shadcn-ui/switch"

interface MobileFileSelectorPopupProps {
	open: boolean
	onClose: () => void
	onConfirm: (selectedFileIds: string[], selectedFiles: AttachmentItem[]) => void
	onSelectionChange?: (selectedFileIds: string[], selectedFiles: AttachmentItem[]) => void
	attachments: AttachmentItem[]
	selectedFileIds: string[]
	defaultOpenFileId?: string
	onDefaultOpenFileChange?: (fileId: string | null) => void
	disabled?: boolean
	allowSetDefaultOpen?: boolean
	shareProject?: boolean
	onShareProjectChange?: (checked: boolean) => void
}

function MobileFileSelectorPopup({
	open,
	onClose,
	onConfirm,
	onSelectionChange,
	attachments,
	selectedFileIds: externalSelectedFileIds,
	defaultOpenFileId,
	onDefaultOpenFileChange,
	disabled = false,
	allowSetDefaultOpen = false,
	shareProject = false,
	onShareProjectChange,
}: MobileFileSelectorPopupProps) {
	const { t } = useTranslation("super")
	const [selectedFileIds, setSelectedFileIds] = useState<string[]>(externalSelectedFileIds)

	// 同步外部传入的 selectedFileIds
	useEffect(() => {
		setSelectedFileIds(externalSelectedFileIds)
	}, [externalSelectedFileIds])

	const handleSelectionChange = useCallback(
		(fileIds: string[], files: AttachmentItem[]) => {
			// 更新内部状态
			setSelectedFileIds(fileIds)
			// 实时同步到父组件（但不关闭弹层）
			onSelectionChange?.(fileIds, files)
		},
		[onSelectionChange],
	)

	return (
		<CommonPopup
			title={t("share.selectFile")}
			popupProps={{
				visible: open,
				onClose,
				onMaskClick: () => {}, // 禁用点击遮罩关闭
				stopPropagation: ["click"],
				style: {
					zIndex: 1030,
				},
			}}
		>
			<div className="flex flex-col gap-2 p-3">
				{/* Share Project Switch */}
				<div className="flex items-start gap-3 rounded-md bg-sidebar-accent p-2">
					<Switch
						checked={shareProject}
						onCheckedChange={(checked) => {
							onShareProjectChange?.(checked)
						}}
					/>
					<div className="flex flex-1 flex-col gap-2">
						<div className="pt-[3px] text-sm font-medium leading-none text-foreground">
							{t("share.shareProject")}
						</div>
						<div className="text-xs leading-normal text-muted-foreground">
							{t("share.shareProjectDescription")}
						</div>
					</div>
				</div>

				{/* File Selector */}
				<FileSelector
					attachments={attachments}
					selectedFileIds={selectedFileIds}
					onSelectionChange={handleSelectionChange}
					defaultSelectedFileIds={externalSelectedFileIds}
					defaultOpenFileId={defaultOpenFileId}
					onDefaultOpenFileChange={onDefaultOpenFileChange}
					disabled={disabled || shareProject}
					allowSetDefaultOpen={allowSetDefaultOpen || shareProject}
				/>
			</div>
		</CommonPopup>
	)
}

export default memo(MobileFileSelectorPopup)
