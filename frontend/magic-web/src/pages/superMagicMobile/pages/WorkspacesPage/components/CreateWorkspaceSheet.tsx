import { useCallback, useState } from "react"
import { X, Check } from "lucide-react"
import { useTranslation } from "react-i18next"

import MagicPopup from "@/components/base-mobile/MagicPopup"
import { Input } from "@/components/shadcn-ui/input"
import {
	MAX_WORKSPACE_NAME_LENGTH,
	clampProjectName,
	isProjectNameAtLimit,
	isProjectNameOverLimit,
} from "@/pages/superMagicMobile/utils/mobileProjectNameLimit"

interface CreateWorkspaceSheetProps {
	isOpen: boolean
	onClose: () => void
	onCreate: (name: string) => Promise<void>
}

export function CreateWorkspaceSheet({ isOpen, onClose, onCreate }: CreateWorkspaceSheetProps) {
	const { t } = useTranslation("super")
	const [value, setValue] = useState("")

	const isOverLimit = isProjectNameOverLimit(value, MAX_WORKSPACE_NAME_LENGTH)
	const isAtLimit = isProjectNameAtLimit(value, MAX_WORKSPACE_NAME_LENGTH)

	const handleOpenChange = useCallback(
		(open: boolean) => {
			if (!open) {
				setValue("")
				onClose()
			}
		},
		[onClose],
	)

	const handleConfirm = useCallback(async () => {
		const name = clampProjectName(value, MAX_WORKSPACE_NAME_LENGTH)
		if (!name) return
		await onCreate(name)
		setValue("")
	}, [value, onCreate])

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
			title={t("workspace.createWorkspaceSheetTitle")}
			headerVariant="actionHeader"
			headerTitle={t("workspace.createWorkspaceSheetTitle")}
			headerLeadingAction={{
				icon: <X />,
				ariaLabel: t("common.cancel"),
				onClick: handleCancel,
				testId: "workspace-create-sheet-cancel",
			}}
			headerTrailingAction={{
				icon: <Check />,
				ariaLabel: t("common.confirm"),
				onClick: () => {
					void handleConfirm()
				},
				disabled: !value.trim() || isOverLimit,
				tone: "primary",
				testId: "workspace-create-sheet-confirm",
			}}
			className="flex flex-col overflow-hidden rounded-t-[14px] border-0 bg-muted p-0"
			bodyClassName="no-scrollbar flex flex-col gap-2.5 overflow-y-auto px-[14px] py-[10px]"
			style={{ boxShadow: "0 -4px 24px rgba(0,0,0,0.08)" }}
			data-testid="workspace-create-sheet-root"
		>
			<div className="flex flex-col gap-2">
				<p className="px-[14px] text-[14px] leading-5 text-muted-foreground">
					{t("workspace.workspaceNameLabel")}
				</p>
				<div className="w-full shrink-0 overflow-hidden rounded-lg bg-card">
					<Input
						type="text"
						value={value}
						maxLength={MAX_WORKSPACE_NAME_LENGTH}
						onChange={(e) => setValue(e.target.value)}
						placeholder={t("workspace.createWorkspaceTip")}
						autoFocus
						className="h-12 rounded-none border-0 bg-transparent px-[14px] py-0 text-[16px] text-foreground shadow-none focus-visible:border-0 focus-visible:ring-0 dark:bg-transparent"
						data-testid="workspace-create-sheet-input"
						onKeyDown={(e) => {
							if (e.key === "Enter") {
								void handleConfirm()
							}
							if (e.key === "Escape") {
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
								maxLength: MAX_WORKSPACE_NAME_LENGTH,
							})}
						</span>
					) : isAtLimit ? (
						<span>
							{t("chat.nameMaxLengthTip", {
								maxLength: MAX_WORKSPACE_NAME_LENGTH,
							})}
						</span>
					) : (
						<span />
					)}
					<span
						className={isOverLimit ? "text-destructive" : ""}
						data-testid="workspace-create-sheet-char-count"
					>
						{value.length}/{MAX_WORKSPACE_NAME_LENGTH}
					</span>
				</div>
			</div>
		</MagicPopup>
	)
}
