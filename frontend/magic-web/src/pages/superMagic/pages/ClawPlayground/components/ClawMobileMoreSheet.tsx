import { X } from "lucide-react"
import { useTranslation } from "react-i18next"
import type { MagicClawItem } from "@/apis"
import MagicPopup from "@/components/base-mobile/MagicPopup"
import { getClawBrandTranslationValues } from "@/pages/superMagic/utils/clawBrand"
import { resolveMagiClawActionAvailability } from "@/pages/superMagic/pages/MagiClawPage/resolveMagiClawActionAvailability"

interface ClawMobileMoreSheetProps {
	magicClaw: MagicClawItem | null
	open: boolean
	displayStatus?: string | null
	isSandboxActionLoading?: boolean
	isUpgradingSandbox?: boolean
	onOpenChange: (open: boolean) => void
	onViewFiles: () => void
	onEditInfo: () => void
	onRestart: () => void
	/** Called when the user taps the Start button (status is stopped/idle). */
	onStart: () => void
	/** Called when the user taps the Stop button (status is running). */
	onStop: () => void
	onUpgradeSandbox?: () => void
	onFeedback?: () => void
}

/**
 * ClawMobileMoreSheet renders the playground more-actions panel with lifecycle rules aligned to the list page.
 */
export function ClawMobileMoreSheet({
	magicClaw,
	open,
	displayStatus,
	isSandboxActionLoading = false,
	isUpgradingSandbox,
	onOpenChange,
	onViewFiles,
	onEditInfo,
	onRestart,
	onStart,
	onStop,
	onUpgradeSandbox,
	onFeedback,
}: ClawMobileMoreSheetProps) {
	const { t } = useTranslation("sidebar")
	const clawBrandValues = getClawBrandTranslationValues()

	const resolvedDisplayStatus = displayStatus ?? magicClaw?.status ?? null
	const actionAvailability = resolveMagiClawActionAvailability({
		displayStatus: resolvedDisplayStatus,
		isActionLoading: isSandboxActionLoading,
	})
	const needUpgrade = magicClaw?.need_upgrade || isUpgradingSandbox

	const filesLabel = t("superLobster.workspace.files", "查看文件")
	const editLabel = t("superLobster.mobile.editInfo", "编辑信息")
	const restartLabel = t("superLobster.created.restart", {
		...clawBrandValues,
		defaultValue: "重新启动",
	})
	const startLabel = t("superLobster.created.start", { ...clawBrandValues, defaultValue: "启动" })
	const stopLabel = t("superLobster.created.stop", { ...clawBrandValues, defaultValue: "停止" })
	const upgradeLabel = isUpgradingSandbox
		? t("superLobster.workspace.updating", { ...clawBrandValues, defaultValue: "正在更新..." })
		: t("superLobster.workspace.update", { ...clawBrandValues, defaultValue: "更新沙盒" })
	const feedbackLabel = t("superLobster.workspace.feedback", "反馈本次对话")

	const showRestart = actionAvailability.restart.visible
	const showStop = actionAvailability.stop.visible
	const showStart = actionAvailability.start.visible

	const lifecycleButtonClassName =
		"flex h-14 w-full items-center justify-start border-b border-border/50 px-5 text-[16px] text-foreground active:opacity-70 disabled:opacity-40"

	return (
		<MagicPopup
			visible={open}
			onClose={() => onOpenChange(false)}
			onOpenChange={onOpenChange}
			headerVariant="actionHeader"
			className="rounded-t-3xl bg-secondary"
			bodyClassName="px-3 pb-8 pt-3 bg-secondary"
			headerLeadingAction={{
				icon: <X className="size-[22px]" />,
				ariaLabel: t("superLobster.mobile.close", "关闭"),
				onClick: () => onOpenChange(false),
			}}
			headerTitle={
				<div className="flex flex-col items-center gap-0.5">
					<div className="w-full truncate text-[18px] font-medium leading-6 text-foreground">
						{magicClaw?.name ||
							t("superLobster.workspace.untitledProject", clawBrandValues)}
					</div>
					<div className="w-full truncate text-[12px] font-normal leading-4 text-muted-foreground">
						{t("superLobster.title", clawBrandValues) || "MagiClaw"}
					</div>
				</div>
			}
		>
			<div className="flex flex-col gap-2.5">
				<div className="flex flex-col overflow-hidden rounded-2xl bg-background">
					<button
						type="button"
						className="flex h-14 w-full items-center justify-start px-5 text-[16px] text-foreground active:opacity-70"
						onClick={() => {
							onOpenChange(false)
							onViewFiles()
						}}
					>
						{filesLabel}
					</button>
				</div>

				<div className="flex flex-col overflow-hidden rounded-2xl bg-background">
					<button
						type="button"
						className="flex h-14 w-full items-center justify-start border-b border-border/50 px-5 text-[16px] text-foreground active:opacity-70 disabled:opacity-40"
						disabled={actionAvailability.edit.disabled}
						onClick={() => {
							if (actionAvailability.edit.disabled) return
							onOpenChange(false)
							onEditInfo()
						}}
					>
						{editLabel}
					</button>
					{needUpgrade ? (
						<button
							type="button"
							className="flex h-14 w-full items-center justify-start border-b border-border/50 px-5 text-[16px] text-indigo-500 active:opacity-70 disabled:opacity-40"
							disabled={isUpgradingSandbox}
							onClick={() => {
								if (isUpgradingSandbox) return
								onOpenChange(false)
								onUpgradeSandbox?.()
							}}
						>
							{upgradeLabel}
						</button>
					) : null}
					{showRestart ? (
						<button
							type="button"
							className={lifecycleButtonClassName}
							disabled={actionAvailability.restart.disabled}
							onClick={() => {
								if (actionAvailability.restart.disabled) return
								onOpenChange(false)
								onRestart()
							}}
						>
							{restartLabel}
						</button>
					) : null}
					{showStop ? (
						<button
							type="button"
							className={lifecycleButtonClassName}
							disabled={actionAvailability.stop.disabled}
							onClick={() => {
								if (actionAvailability.stop.disabled) return
								onOpenChange(false)
								onStop()
							}}
						>
							{stopLabel}
						</button>
					) : null}
					{showStart ? (
						<button
							type="button"
							className="flex h-14 w-full items-center justify-start px-5 text-[16px] text-foreground active:opacity-70 disabled:opacity-40"
							disabled={actionAvailability.start.disabled}
							onClick={() => {
								if (actionAvailability.start.disabled) return
								onOpenChange(false)
								onStart()
							}}
						>
							{startLabel}
						</button>
					) : null}
				</div>

				<div className="flex flex-col overflow-hidden rounded-2xl bg-background">
					<button
						type="button"
						className="flex h-14 w-full items-center justify-start px-5 text-[16px] text-foreground active:opacity-70"
						onClick={() => {
							onOpenChange(false)
							onFeedback?.()
						}}
					>
						{feedbackLabel}
					</button>
				</div>
			</div>
		</MagicPopup>
	)
}
