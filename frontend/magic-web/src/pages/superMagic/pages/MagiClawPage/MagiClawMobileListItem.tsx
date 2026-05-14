import { ArrowUp, Ellipsis, Loader2, MessageCircle } from "lucide-react"
import type { MagicClawItem } from "@/apis"
import type { MagicClawStatus } from "@/apis/modules/magicClawStatus"
import { Button } from "@/components/shadcn-ui/button"
import { cn } from "@/lib/utils"
import { MagiClawStatusBadge } from "./MagiClawStatusBadge"
import { MagiClawTemplateAvatar } from "./MagiClawTemplateAvatar"
import { getMagiClawDisplayName, getMagiClawRowId } from "./useMagiClawMobilePage"

interface MagiClawMobileListItemProps {
	claw: MagicClawItem
	displayStatus: MagicClawStatus | string
	displayName: string
	isActionLoading: boolean
	showUpgradeButton: boolean
	chatLabel: string
	moreActionsLabel: string
	onOpenMenu: (claw: MagicClawItem, anchor: HTMLElement) => void
	onOpenChat: (claw: MagicClawItem) => void
	onUpgradeClaw: (claw: MagicClawItem) => void
}

/**
 * MagiClawMobileListItem 负责渲染原型中的单条列表卡片和主要行内操作。
 */
export function MagiClawMobileListItem({
	claw,
	displayStatus,
	displayName,
	isActionLoading,
	showUpgradeButton,
	chatLabel,
	moreActionsLabel,
	onOpenMenu,
	onOpenChat,
	onUpgradeClaw,
}: MagiClawMobileListItemProps) {
	const rowId = getMagiClawRowId(claw)

	return (
		<div
			className="overflow-hidden rounded-2xl bg-card shadow-[0px_2px_12px_0px_rgba(0,0,0,0.06)]"
			data-testid={`magi-claw-mobile-item-${rowId}`}
		>
			<div className="flex min-h-[68px] items-center gap-3 px-4 py-2">
				<MagiClawTemplateAvatar
					templateCode={claw.template_code}
					src={claw.icon_file_url}
					className="h-10 w-10 shrink-0 rounded-full border border-border"
				/>

				<div className="flex min-w-0 flex-1 flex-col gap-0.5">
					<p className="truncate text-[15px] font-medium text-foreground">
						{displayName}
					</p>
					<div className="flex flex-wrap items-center gap-1.5">
						<MagiClawStatusBadge
							status={displayStatus}
							className="h-auto min-h-0 rounded-none border-none bg-transparent px-0 py-0 text-[12px] shadow-none [&>span:first-child]:h-1.5 [&>span:first-child]:w-1.5"
							data-testid={`magi-claw-mobile-item-status-${rowId}`}
						/>
					</div>
				</div>

				<div className="flex shrink-0 items-center gap-2">
					{/* 升级入口对齐原型，仅保留浅黄圆形按钮和点击后的 loading 反馈。 */}
					{showUpgradeButton ? (
						<Button
							type="button"
							variant="ghost"
							size="icon"
							className="h-9 w-9 rounded-full border border-amber-300 bg-amber-50 text-amber-600 shadow-none active:opacity-60 dark:border-amber-700 dark:bg-amber-950/30 dark:text-amber-400"
							data-testid={`magi-claw-mobile-item-upgrade-${rowId}`}
							disabled={isActionLoading || !claw.code}
							onClick={() => onUpgradeClaw(claw)}
						>
							{isActionLoading ? (
								<Loader2 className="h-4 w-4 animate-spin" aria-hidden />
							) : (
								<ArrowUp className="h-4 w-4" aria-hidden />
							)}
						</Button>
					) : null}

					<Button
						type="button"
						variant="ghost"
						size="icon"
						className="h-9 w-9 rounded-full border border-border bg-background/80 shadow-none transition-opacity active:opacity-60"
						aria-label={moreActionsLabel}
						data-testid={`magi-claw-mobile-item-more-${rowId}`}
						onClick={(event) => onOpenMenu(claw, event.currentTarget)}
					>
						<Ellipsis className="h-4 w-4 text-foreground" aria-hidden />
					</Button>

					<Button
						type="button"
						variant="ghost"
						className={cn(
							"h-9 rounded-full border border-border bg-background/80 px-3 text-[13px] font-medium leading-none text-primary shadow-none transition-opacity active:opacity-60",
							"gap-1.5",
						)}
						data-testid={`magi-claw-mobile-item-chat-${rowId}`}
						disabled={!claw.code}
						onClick={() => onOpenChat(claw)}
					>
						<MessageCircle className="h-4 w-4 text-primary" aria-hidden />
						{chatLabel}
					</Button>
				</div>
			</div>
		</div>
	)
}

/**
 * 使用统一 helper 构造行展示名，给列表层一个便捷出口。
 */
export function resolveMagiClawMobileDisplayName(
	claw: MagicClawItem,
	t: (key: string, values?: Record<string, unknown>) => string,
	clawBrandValues: Record<string, unknown>,
) {
	return getMagiClawDisplayName(claw, t, clawBrandValues)
}
