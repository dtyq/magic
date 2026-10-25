import { useCallback, useState } from "react"
import { Check, X } from "lucide-react"
import { useTranslation } from "react-i18next"

import MagicPopup from "@/components/base-mobile/MagicPopup"
import { Input } from "@/components/shadcn-ui/input"
import {
	MAX_PROJECT_NAME_LENGTH,
	clampProjectName,
	isProjectNameAtLimit,
	isProjectNameOverLimit,
} from "@/pages/superMagicMobile/utils/mobileProjectNameLimit"

interface CreateProjectSheetProps {
	isOpen: boolean
	onClose: () => void
	onCreate: (name: string) => Promise<void>
}

/**
 * 承载移动端新建项目的底部表单，让用户先确认项目名再触发真实创建。
 */
export function CreateProjectSheet({ isOpen, onClose, onCreate }: CreateProjectSheetProps) {
	const { t } = useTranslation("super")
	const [value, setValue] = useState("")

	const isOverLimit = isProjectNameOverLimit(value)
	const isAtLimit = isProjectNameAtLimit(value)

	/**
	 * 统一处理 Sheet 的开关回调，关闭时顺手清空上次未提交的输入内容。
	 */
	const handleOpenChange = useCallback(
		(open: boolean) => {
			if (!open) {
				setValue("")
				onClose()
			}
		},
		[onClose],
	)

	/**
	 * 仅在输入非空且未超长时提交创建，避免把空白或超长名称透传到业务层。
	 */
	const handleConfirm = useCallback(async () => {
		const normalizedValue = clampProjectName(value)
		if (!normalizedValue || isProjectNameOverLimit(value.trim())) return
		await onCreate(normalizedValue)
		setValue("")
	}, [onCreate, value])

	const handleCancel = useCallback(() => {
		setValue("")
		onClose()
	}, [onClose])

	return (
		<MagicPopup
			visible={isOpen}
			onOpenChange={handleOpenChange}
			onClose={handleCancel}
			position="bottom"
			title={t("project.createNewProject")}
			headerVariant="actionHeader"
			headerTitle={t("project.createNewProject")}
			headerLeadingAction={{
				icon: <X />,
				ariaLabel: t("common.cancel"),
				onClick: handleCancel,
				testId: "workspace-project-create-sheet-cancel",
			}}
			headerTrailingAction={{
				icon: <Check />,
				ariaLabel: t("common.confirm"),
				onClick: () => {
					void handleConfirm()
				},
				disabled: !value.trim() || isOverLimit,
				tone: "primary",
				testId: "workspace-project-create-sheet-confirm",
			}}
			className="flex flex-col overflow-hidden rounded-t-[14px] border-0 bg-muted p-0"
			bodyClassName="no-scrollbar flex flex-col gap-2.5 overflow-y-auto px-[14px] py-[10px]"
			style={{ boxShadow: "0 -4px 24px rgba(0,0,0,0.08)" }}
			data-testid="workspace-project-create-sheet"
		>
			<div className="flex flex-col gap-2">
				<p className="px-[14px] text-[14px] leading-5 text-muted-foreground">
					{t("hierarchicalWorkspacePopup.name")}
				</p>
				<div className="w-full shrink-0 overflow-hidden rounded-lg bg-card">
					<Input
						type="text"
						value={value}
						maxLength={MAX_PROJECT_NAME_LENGTH}
						onChange={(event) => setValue(event.target.value)}
						placeholder={t("hierarchicalWorkspacePopup.inputProjectName")}
						autoFocus
						className="h-12 rounded-none border-0 bg-transparent px-[14px] py-0 text-[16px] text-foreground shadow-none focus-visible:border-0 focus-visible:ring-0 dark:bg-transparent"
						data-testid="workspace-project-create-sheet-input"
						onKeyDown={(event) => {
							if (event.key === "Enter") {
								void handleConfirm()
							}
							if (event.key === "Escape") {
								handleCancel()
							}
						}}
					/>
				</div>
				{/* Character counter and limit reminder */}
				<div className="flex items-center justify-between px-[14px] text-xs text-muted-foreground">
					{isOverLimit ? (
						<span className="text-destructive">
							{t("chat.nameMaxLengthTip", {
								maxLength: MAX_PROJECT_NAME_LENGTH,
							})}
						</span>
					) : isAtLimit ? (
						<span>
							{t("chat.nameMaxLengthTip", {
								maxLength: MAX_PROJECT_NAME_LENGTH,
							})}
						</span>
					) : (
						<span />
					)}
					<span
						className={isOverLimit ? "text-destructive" : ""}
						data-testid="workspace-project-create-sheet-char-count"
					>
						{value.length}/{MAX_PROJECT_NAME_LENGTH}
					</span>
				</div>
			</div>
		</MagicPopup>
	)
}
