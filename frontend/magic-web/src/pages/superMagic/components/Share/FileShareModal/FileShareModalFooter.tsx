import { memo } from "react"
import { useTranslation } from "react-i18next"
import { Button } from "@/components/shadcn-ui/button"
import { useIsMobile } from "@/hooks/useIsMobile"
import { openShareManagementModal } from "@/pages/superMagic/components/ShareManagement/openShareManagementModal"

interface FileShareModalFooterProps {
	mode: "create" | "edit"
	onCancel: () => void
	onSave: () => void
	onCancelShare?: () => void
	isSaving?: boolean
	isDisabled?: boolean
}

export default memo(function FileShareModalFooter(props: FileShareModalFooterProps) {
	const { mode, onCancel, onSave, onCancelShare, isSaving, isDisabled } = props
	const { t } = useTranslation("super")
	const isMobile = useIsMobile()

	// 移动端：只显示生成分享链接按钮
	if (isMobile) {
		return (
			<div className="flex items-center justify-center gap-1.5 self-stretch border-t border-[#E5E5E5] px-3 py-3">
				<Button
					variant="outline"
					size="default"
					onClick={onCancel}
					className="h-9 px-4 py-2"
				>
					{t("common.cancel")}
				</Button>
				<Button
					variant="default"
					size="default"
					onClick={onSave}
					disabled={isDisabled || isSaving}
					className="flex-1 px-4 py-2"
				>
					{isSaving
						? t("common.saving")
						: mode === "create"
							? t("share.generateShareLink")
							: t("common.save")}
				</Button>
			</div>
		)
	}

	// 桌面端：显示完整按钮布局
	return (
		<div className="flex items-center justify-between gap-1.5 self-stretch border-t border-[#E5E5E5] px-3 py-3">
			{/* 左侧按钮 */}
			<div>
				{mode === "create" && (
					<Button
						variant="outline"
						size="default"
						onClick={() => {
							openShareManagementModal()
							onCancel()
						}}
						className="h-9 px-4 py-2"
					>
						{t("share.manageShareLinks")}
					</Button>
				)}
				{mode === "edit" && onCancelShare && (
					<Button
						variant="ghost"
						size="default"
						onClick={onCancelShare}
						className="h-9 px-4 py-2 text-[#DC2626] hover:bg-transparent hover:text-[#DC2626]"
					>
						{t("share.cancelShare")}
					</Button>
				)}
			</div>

			{/* 右侧按钮组 */}
			<div className="flex items-center gap-1.5">
				<Button
					variant="outline"
					size="default"
					onClick={onCancel}
					className="h-9 px-4 py-2"
				>
					{t("common.cancel")}
				</Button>
				<Button
					variant="default"
					size="default"
					onClick={onSave}
					disabled={isDisabled || isSaving}
					className="h-9 px-4 py-2"
				>
					{isSaving
						? t("common.saving")
						: mode === "create"
							? t("share.generateShareLink")
							: t("common.save")}
				</Button>
			</div>
		</div>
	)
})
