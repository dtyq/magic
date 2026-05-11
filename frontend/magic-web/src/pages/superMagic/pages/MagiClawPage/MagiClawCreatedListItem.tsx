import { Ellipsis, MessageCircle, Pause, Play, RefreshCw, Trash2 } from "lucide-react"
import type { MagicClawItem } from "@/apis"
import type { MagicClawStatus } from "@/apis/modules/magicClawStatus"
import MagicDropdown from "@/components/base/MagicDropdown"
import { Button } from "@/components/shadcn-ui/button"
import { getClawBrandTranslationValues } from "@/pages/superMagic/utils/clawBrand"
import { getMagiClawMenuActionSequence } from "./magiClawMenuActions"
import { MagiClawStatusBadge } from "./MagiClawStatusBadge"
import { MagiClawTemplateAvatar } from "./MagiClawTemplateAvatar"
import { MagiClawUpgradeBadge, shouldShowMagiClawUpgradeBadge } from "./MagiClawUpgradeBadge"

interface MagiClawCreatedListItemProps {
	claw: MagicClawItem
	displayStatus: MagicClawStatus | string
	isActionLoading: boolean
	onDelete: (claw: MagicClawItem) => void
	onOpenClawPlayground: (claw: MagicClawItem) => void
	onRestart: (claw: MagicClawItem) => void
	onStart: (claw: MagicClawItem) => void
	onStop: (claw: MagicClawItem) => void
	onUpgradeClaw?: (claw: MagicClawItem) => void
	t: (key: string, values?: Record<string, unknown>) => string
	upgradeBadgeDismissed?: boolean
}

const actionMenuOverlayClassName = "min-w-[224px]"

export function MagiClawCreatedListItem({
	claw,
	displayStatus,
	isActionLoading,
	onDelete,
	onOpenClawPlayground,
	onRestart,
	onStart,
	onStop,
	onUpgradeClaw,
	t,
	upgradeBadgeDismissed = false,
}: MagiClawCreatedListItemProps) {
	const clawBrandValues = getClawBrandTranslationValues()
	const rowId = claw.code || claw.id
	const displayName = claw.name || t("superLobster.workspace.untitledProject", clawBrandValues)
	const showUpgradeBadge =
		shouldShowMagiClawUpgradeBadge(claw.need_upgrade) && !upgradeBadgeDismissed

	function buildMenuItems() {
		return getMagiClawMenuActionSequence(displayStatus).map((action) => {
			switch (action) {
				case "restart":
					return {
						key: "restart",
						label: t("superLobster.created.restart", clawBrandValues),
						disabled: isActionLoading,
						"data-testid": `magi-claw-created-item-restart-${rowId}`,
						icon: <RefreshCw className="size-4" aria-hidden />,
						onClick: () => {
							onRestart(claw)
						},
					}
				case "stop":
					return {
						key: "stop",
						label: t("superLobster.created.stop", clawBrandValues),
						disabled: isActionLoading,
						"data-testid": `magi-claw-created-item-stop-${rowId}`,
						icon: <Pause className="size-4" aria-hidden />,
						onClick: () => {
							onStop(claw)
						},
					}
				case "start":
					return {
						key: "start",
						label: t("superLobster.created.start", clawBrandValues),
						disabled: !claw.code || isActionLoading,
						"data-testid": `magi-claw-created-item-start-${rowId}`,
						icon: <Play className="size-4" aria-hidden />,
						onClick: () => {
							onStart(claw)
						},
					}
				case "delete":
					return {
						key: "delete",
						label: t("superLobster.created.delete", clawBrandValues),
						danger: true,
						disabled: isActionLoading,
						"data-testid": `magi-claw-created-item-delete-${rowId}`,
						icon: <Trash2 className="size-4" aria-hidden />,
						onClick: () => {
							onDelete(claw)
						},
					}
				case "divider":
					return { type: "divider" as const }
			}
		})
	}

	return (
		<div
			className="flex items-center gap-3 overflow-hidden rounded-[10px] bg-sidebar px-4 py-3"
			data-testid={`magi-claw-created-item-${rowId}`}
		>
			<MagiClawTemplateAvatar
				templateCode={claw.template_code}
				src={claw.icon_file_url}
				className="size-12 shrink-0 rounded-full border border-border"
			/>

			<div className="flex min-w-0 flex-1 items-center gap-2">
				<p className="min-w-0 truncate text-sm font-medium leading-none text-foreground">
					{displayName}
				</p>
				<MagiClawStatusBadge
					status={displayStatus}
					data-testid={`magi-claw-created-item-status-${rowId}`}
				/>
			</div>

			<div className="flex items-center gap-2">
				{showUpgradeBadge ? (
					<MagiClawUpgradeBadge
						data-testid={`magi-claw-created-item-upgrade-${rowId}`}
						disabled={isActionLoading || !claw.code}
						onClick={onUpgradeClaw && claw.code ? () => onUpgradeClaw(claw) : undefined}
					/>
				) : null}
				<MagicDropdown
					menu={{
						items: buildMenuItems(),
					}}
					placement="bottomRight"
					overlayClassName={actionMenuOverlayClassName}
				>
					<span>
						<Button
							type="button"
							variant="outline"
							size="icon"
							className="size-9 rounded-md bg-background"
							data-testid={`magi-claw-created-item-more-button-${rowId}`}
							disabled={isActionLoading}
							aria-label={t("superLobster.mobile.moreActions", clawBrandValues)}
						>
							<Ellipsis className="size-4" aria-hidden />
						</Button>
					</span>
				</MagicDropdown>
				<Button
					type="button"
					variant="outline"
					className="h-9 rounded-md bg-background px-4 text-sm font-medium"
					data-testid={`magi-claw-created-item-chat-button-${rowId}`}
					disabled={!claw.code}
					onClick={() => onOpenClawPlayground(claw)}
				>
					<MessageCircle className="size-4" />
					{t("superLobster.created.chat", clawBrandValues)}
				</Button>
			</div>
		</div>
	)
}
