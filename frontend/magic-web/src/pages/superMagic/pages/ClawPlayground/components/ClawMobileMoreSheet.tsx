import { X } from "lucide-react"
import { useTranslation } from "react-i18next"
import type { MagicClawItem } from "@/apis"
import { MAGIC_CLAW_STATUS } from "@/apis/modules/magicClaw"
import MagicPopup from "@/components/base-mobile/MagicPopup"
import { getClawBrandTranslationValues } from "@/pages/superMagic/utils/clawBrand"

interface ClawMobileMoreSheetProps {
	magicClaw: MagicClawItem | null
	open: boolean
	isUpgradingSandbox?: boolean
	onOpenChange: (open: boolean) => void
	onViewFiles: () => void
	onEditInfo: () => void
	onRestart: () => void
	onToggleRun: () => void
	onUpgradeSandbox?: () => void
	onFeedback?: () => void
}

export function ClawMobileMoreSheet({
	magicClaw,
	open,
	isUpgradingSandbox,
	onOpenChange,
	onViewFiles,
	onEditInfo,
	onRestart,
	onToggleRun,
	onUpgradeSandbox,
	onFeedback,
}: ClawMobileMoreSheetProps) {
	const { t } = useTranslation("sidebar")
	const clawBrandValues = getClawBrandTranslationValues()

	const isRunning = magicClaw?.status === MAGIC_CLAW_STATUS.RUNNING
	const needUpgrade = magicClaw?.need_upgrade || isUpgradingSandbox

	const filesLabel = t("superLobster.workspace.files", "查看文件")
	const editLabel = t("superLobster.mobile.editInfo", "编辑信息")
	const restartLabel = t("superLobster.created.restart", {
		...clawBrandValues,
		defaultValue: "重新启动",
	})
	const toggleRunLabel = isRunning
		? t("superLobster.created.stop", { ...clawBrandValues, defaultValue: "停止" })
		: t("superLobster.created.start", { ...clawBrandValues, defaultValue: "启动" })
	const upgradeLabel = isUpgradingSandbox
		? t("superLobster.workspace.updating", { ...clawBrandValues, defaultValue: "正在更新..." })
		: t("superLobster.workspace.update", { ...clawBrandValues, defaultValue: "更新沙盒" })
	const feedbackLabel = t("superLobster.workspace.feedback", "反馈本次对话")

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
						className="flex h-14 w-full items-center justify-start border-b border-border/50 px-5 text-[16px] text-foreground active:opacity-70"
						onClick={() => {
							onOpenChange(false)
							onEditInfo()
						}}
					>
						{editLabel}
					</button>
					{needUpgrade && (
						<button
							type="button"
							className="flex h-14 w-full items-center justify-start border-b border-border/50 px-5 text-[16px] text-indigo-500 active:opacity-70"
							disabled={isUpgradingSandbox}
							onClick={() => {
								onOpenChange(false)
								onUpgradeSandbox?.()
							}}
						>
							{upgradeLabel}
						</button>
					)}
					<button
						type="button"
						className="flex h-14 w-full items-center justify-start border-b border-border/50 px-5 text-[16px] text-foreground active:opacity-70"
						onClick={() => {
							onOpenChange(false)
							onRestart()
						}}
					>
						{restartLabel}
					</button>
					<button
						type="button"
						className="flex h-14 w-full items-center justify-start px-5 text-[16px] text-foreground active:opacity-70"
						onClick={() => {
							onOpenChange(false)
							onToggleRun()
						}}
					>
						{toggleRunLabel}
					</button>
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
