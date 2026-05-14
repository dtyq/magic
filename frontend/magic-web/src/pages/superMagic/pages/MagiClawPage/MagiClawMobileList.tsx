import { CirclePlus, Loader2 } from "lucide-react"
import type { MagicClawItem } from "@/apis"
import { Button } from "@/components/shadcn-ui/button"
import { DefaultMagiClawAvatar } from "./components/DefaultMagiClawAvatar"
import { shouldShowMagiClawUpgradeBadge } from "./MagiClawUpgradeBadge"
import { MagiClawMobileListItem, resolveMagiClawMobileDisplayName } from "./MagiClawMobileListItem"
import { getMagiClawRowId } from "./useMagiClawMobilePage"

interface MagiClawMobileListProps {
	claws: MagicClawItem[]
	clawBrandValues: Record<string, unknown>
	t: (key: string, values?: Record<string, unknown>) => string
	visibleListLoading: boolean
	visibleListError?: Error
	activeActionClawCode: string | null
	dismissedUpgradeBadgeByClawKey: Record<string, boolean>
	getDisplayedClawStatus: (claw: MagicClawItem) => string
	canCreateMagicClaw: boolean
	createButtonLabel: string
	onOpenCreate: () => void
	onRetry: () => void
	onOpenMenu: (claw: MagicClawItem, anchor: HTMLElement) => void
	onOpenChat: (claw: MagicClawItem) => void
	onUpgradeClaw: (claw: MagicClawItem) => void
}

const listStateClassName =
	"flex min-h-[160px] flex-col items-center justify-center gap-3 rounded-2xl bg-card px-6 py-8 text-center shadow-[0px_2px_12px_0px_rgba(0,0,0,0.06)]"

/**
 * MagiClawMobileList 负责切换移动端的加载、错误、空态和列表态内容。
 */
export function MagiClawMobileList({
	claws,
	clawBrandValues,
	t,
	visibleListLoading,
	visibleListError,
	activeActionClawCode,
	dismissedUpgradeBadgeByClawKey,
	getDisplayedClawStatus,
	canCreateMagicClaw,
	createButtonLabel,
	onOpenCreate,
	onRetry,
	onOpenMenu,
	onOpenChat,
	onUpgradeClaw,
}: MagiClawMobileListProps) {
	if (visibleListLoading) {
		return (
			<div className={listStateClassName} data-testid="magi-claw-mobile-list-loading">
				<Loader2 className="h-5 w-5 animate-spin text-muted-foreground" aria-hidden />
				<p className="text-sm text-muted-foreground">
					{t("superLobster.created.listLoading", clawBrandValues)}
				</p>
			</div>
		)
	}

	if (visibleListError) {
		return (
			<div className={listStateClassName} data-testid="magi-claw-mobile-list-error">
				<p className="text-sm text-muted-foreground">
					{t("superLobster.created.listLoadFailed", clawBrandValues)}
				</p>
				<Button
					type="button"
					variant="outline"
					size="sm"
					className="w-fit rounded-full"
					data-testid="magi-claw-mobile-list-retry"
					onClick={onRetry}
				>
					{t("superLobster.created.listRetry", clawBrandValues)}
				</Button>
			</div>
		)
	}

	if (claws.length === 0) {
		return (
			<div className="flex flex-col gap-3.5" data-testid="magi-claw-mobile-list-empty">
				<p className="px-0.5 text-[18px] font-medium leading-tight text-foreground">
					{t("superLobster.getStarted")}
				</p>
				<div
					className="flex flex-col items-center gap-4 rounded-2xl bg-card px-5 py-6 shadow-[0px_2px_12px_0px_rgba(0,0,0,0.06)]"
					data-testid="magi-claw-mobile-get-started-card"
				>
					<div className="relative flex h-[72px] w-[72px] items-center justify-center overflow-hidden rounded-full border border-border bg-background shadow-[0px_4px_20px_0px_rgba(0,0,0,0.08)]">
						<DefaultMagiClawAvatar />
					</div>
					<div className="flex flex-col items-center gap-1 text-center">
						<p className="text-[17px] font-medium leading-snug text-foreground">
							{t("superLobster.card.title", clawBrandValues)}
						</p>
						<p className="text-[13px] leading-snug text-muted-foreground">
							{t("superLobster.card.description", clawBrandValues)}
						</p>
					</div>
					<Button
						type="button"
						className="h-12 w-full gap-2 rounded-full bg-foreground text-[15px] font-medium text-background shadow-none hover:bg-foreground/90"
						data-testid="magi-claw-mobile-create-cta"
						disabled={!canCreateMagicClaw}
						onClick={onOpenCreate}
					>
						<CirclePlus className="h-5 w-5" aria-hidden />
						{createButtonLabel}
					</Button>
				</div>
			</div>
		)
	}

	return (
		<div className="flex flex-col gap-3.5" data-testid="magi-claw-mobile-list-section">
			<p className="px-0.5 text-[18px] font-medium leading-tight text-foreground">
				{t("superLobster.mobile.createdByMe", clawBrandValues)}
			</p>
			<div className="flex flex-col gap-3" data-testid="magi-claw-mobile-created-list">
				{claws.map((claw) => {
					const rowId = getMagiClawRowId(claw)
					return (
						<MagiClawMobileListItem
							key={rowId}
							claw={claw}
							displayStatus={getDisplayedClawStatus(claw)}
							displayName={resolveMagiClawMobileDisplayName(claw, t, clawBrandValues)}
							isActionLoading={activeActionClawCode === claw.code}
							showUpgradeButton={
								shouldShowMagiClawUpgradeBadge(claw.need_upgrade) &&
								!dismissedUpgradeBadgeByClawKey[rowId]
							}
							chatLabel={t("superLobster.created.chat", clawBrandValues)}
							moreActionsLabel={t("superLobster.mobile.moreActions", clawBrandValues)}
							onOpenMenu={onOpenMenu}
							onOpenChat={onOpenChat}
							onUpgradeClaw={onUpgradeClaw}
						/>
					)
				})}
			</div>
		</div>
	)
}
