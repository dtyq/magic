import { useEffect, useState } from "react"
import { CirclePlus, Loader2, RefreshCw } from "lucide-react"
import { useTranslation } from "react-i18next"
import { FUNCTION_PERMISSION_CODE, type MagicClawItem } from "@/apis"
import { MAGIC_CLAW_STATUS } from "@/apis/modules/magicClawStatus"
import { useConfirmDialog } from "@/components/shadcn-composed/confirm-dialog"
import { Button } from "@/components/shadcn-ui/button"
import { cn } from "@/lib/utils"
import { getClawBrandTranslationValues } from "@/pages/superMagic/utils/clawBrand"
import { DefaultMagiClawAvatar } from "./components/DefaultMagiClawAvatar"
import { MagiClawCreatedListItem } from "./MagiClawCreatedListItem"
import { confirmMagiClawSandboxUpgrade } from "./magiClawSandboxUpgradeConfirm"
import { useMagiClawCreatedSectionActions } from "./useMagiClawCreatedSectionActions"
import { useFunctionPermission } from "@/hooks/useFunctionPermission"

interface MagiClawCreatedSectionProps {
	claws: MagicClawItem[]
	listLoading: boolean
	isRefreshingList?: boolean
	listError?: Error
	onRefreshList: () => Promise<unknown>
	onOpenCreate: () => void
	onOpenClawPlayground: (clawCode: string) => void
}

const centeredListStateClassName =
	"flex min-h-[240px] flex-col items-center justify-center py-8 text-center"

export function MagiClawCreatedSection({
	claws,
	listLoading,
	isRefreshingList = false,
	listError,
	onRefreshList,
	onOpenCreate,
	onOpenClawPlayground,
}: MagiClawCreatedSectionProps) {
	const { t } = useTranslation("sidebar")
	const clawBrandValues = getClawBrandTranslationValues()
	const { confirm, dialog } = useConfirmDialog()
	const { isAllowed: canCreateMagicClaw } = useFunctionPermission(
		FUNCTION_PERMISSION_CODE.MagicClawCreate,
	)
	const [upgradeBadgeDismissedByClawKey, setUpgradeBadgeDismissedByClawKey] = useState<
		Record<string, boolean>
	>({})
	const {
		activeActionClawCode,
		getDisplayedClawStatus,
		handleDeleteClaw,
		handleOpenClawPlaygroundWithPreWarm,
		handleRestartClaw,
		handleUpgradeClaw,
		handleStartClaw,
		handleStopClaw,
	} = useMagiClawCreatedSectionActions({
		claws,
		onRefreshList,
		onOpenClawPlayground,
		t,
		clawBrandValues,
	})

	const showEmptyGetStarted = !listLoading && !listError && claws.length === 0
	const createButtonLabel = canCreateMagicClaw
		? t("superLobster.created.create", clawBrandValues)
		: t("superLobster.created.noCreatePermission")

	useEffect(() => {
		setUpgradeBadgeDismissedByClawKey((prev) => {
			const next = { ...prev }
			let changed = false
			for (const claw of claws) {
				const key = claw.code || claw.id
				if (!claw.need_upgrade && next[key]) {
					delete next[key]
					changed = true
				}
			}
			return changed ? next : prev
		})
	}, [claws])

	function handleConfirmUpgradeClaw(claw: MagicClawItem) {
		const rowKey = claw.code || claw.id
		confirmMagiClawSandboxUpgrade(confirm, {
			claw,
			t,
			clawBrandValues,
			onConfirm: () => {
				setUpgradeBadgeDismissedByClawKey((prev) => ({ ...prev, [rowKey]: true }))
				const status = getDisplayedClawStatus(claw)
				if (status === MAGIC_CLAW_STATUS.RUNNING) {
					void handleUpgradeClaw(claw)
					return
				}
				void handleStartClaw(claw)
			},
		})
	}

	function handleConfirmDelete(claw: MagicClawItem) {
		const displayName =
			claw.name || t("superLobster.workspace.untitledProject", clawBrandValues)

		confirm({
			title: t("superLobster.created.deleteConfirmTitle", {
				...clawBrandValues,
				name: displayName,
			}),
			description: t("superLobster.created.deleteConfirmDescription", clawBrandValues),
			confirmText: t("superLobster.created.delete", clawBrandValues),
			variant: "destructive",
			destructivePresentation: "soft",
			dialogSize: "sm",
			onConfirm: () => {
				void handleDeleteClaw(claw)
			},
		})
	}

	return (
		<>
			{dialog}
			<section className="flex flex-col gap-3 px-2.5" data-testid="magi-claw-created-section">
				<div className="flex flex-wrap items-center justify-between gap-3">
					<h2 className="text-base font-medium leading-6 text-foreground">
						{showEmptyGetStarted
							? t("superLobster.getStarted")
							: t("superLobster.created.title", clawBrandValues)}
					</h2>

					<div className="flex items-center gap-2">
						{/* {showEmptyGetStarted ? (
							<Button
								type="button"
								variant="ghost"
								size="sm"
								className="h-8 gap-1 px-3 text-xs font-normal text-foreground"
								data-testid="magi-claw-user-guide-button"
								onClick={() => openNewTab(MAGI_CLAW_USER_GUIDE_URL)}
							>
								<BookOpen className="size-4 shrink-0" aria-hidden />
								{t("superLobster.created.userGuide", clawBrandValues)}
							</Button>
						) : null} */}
						{showEmptyGetStarted ? null : (
							<>
								<Button
									type="button"
									variant="outline"
									size="icon"
									className="size-9 rounded-md bg-background shadow-xs"
									data-testid="magi-claw-refresh-button"
									aria-label={t("superLobster.created.refresh", clawBrandValues)}
									disabled={isRefreshingList}
									onClick={() => void onRefreshList()}
								>
									<RefreshCw
										className={cn("size-4", isRefreshingList && "animate-spin")}
										aria-hidden
									/>
								</Button>
								<Button
									type="button"
									className="h-9 gap-2 rounded-md px-4 text-sm font-medium shadow-xs"
									data-testid="magi-claw-create-button"
									disabled={!canCreateMagicClaw}
									onClick={onOpenCreate}
								>
									<CirclePlus className="size-4" />
									{createButtonLabel}
								</Button>
							</>
						)}
					</div>
				</div>

				<div className="flex flex-col gap-2" data-testid="magi-claw-created-list">
					{listLoading ? (
						<div className={cn(centeredListStateClassName, "gap-3")}>
							<Loader2
								className="size-5 animate-spin text-muted-foreground"
								aria-hidden
							/>
							<p
								className="text-sm text-muted-foreground"
								data-testid="magi-claw-list-loading"
							>
								{t("superLobster.created.listLoading", clawBrandValues)}
							</p>
						</div>
					) : listError ? (
						<div className={cn(centeredListStateClassName, "gap-3")}>
							<p
								className="text-sm text-muted-foreground"
								data-testid="magi-claw-list-error"
							>
								{t("superLobster.created.listLoadFailed", clawBrandValues)}
							</p>
							<Button
								type="button"
								variant="outline"
								size="sm"
								className="w-fit"
								data-testid="magi-claw-list-retry-button"
								onClick={() => void onRefreshList()}
							>
								{t("superLobster.created.listRetry", clawBrandValues)}
							</Button>
						</div>
					) : claws.length === 0 ? (
						<div
							className="flex flex-col gap-3 overflow-hidden rounded-lg bg-sidebar px-4 py-3 sm:flex-row sm:items-center sm:gap-3"
							data-testid="magi-claw-list-empty"
						>
							<div className="flex min-w-0 flex-1 flex-col gap-3 sm:flex-row sm:items-center sm:gap-3">
								<div className="flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-full bg-background">
									<DefaultMagiClawAvatar />
								</div>
								<div className="flex min-w-0 flex-1 flex-col gap-2">
									<p className="text-sm font-medium leading-none text-foreground">
										{t("superLobster.card.title", clawBrandValues)}
									</p>
									<p className="text-sm font-normal leading-none text-muted-foreground">
										{t("superLobster.card.description", clawBrandValues)}
									</p>
								</div>
							</div>
							<Button
								type="button"
								className="h-9 w-full shrink-0 gap-2 px-4 text-sm font-medium shadow-xs sm:w-auto"
								data-testid="magi-claw-empty-create-button"
								disabled={!canCreateMagicClaw}
								onClick={onOpenCreate}
							>
								<CirclePlus className="size-4" aria-hidden />
								{createButtonLabel}
							</Button>
						</div>
					) : (
						claws.map((claw) => {
							const rowKey = claw.code || claw.id
							const displayStatus = getDisplayedClawStatus(claw)
							const isActionLoading = activeActionClawCode === claw.code

							return (
								<MagiClawCreatedListItem
									key={rowKey}
									claw={claw}
									displayStatus={displayStatus}
									isActionLoading={isActionLoading}
									upgradeBadgeDismissed={Boolean(
										upgradeBadgeDismissedByClawKey[rowKey],
									)}
									onDelete={handleConfirmDelete}
									onOpenClawPlayground={handleOpenClawPlaygroundWithPreWarm}
									onRestart={(currentClaw) => {
										void handleRestartClaw(currentClaw)
									}}
									onStart={(currentClaw) => {
										void handleStartClaw(currentClaw)
									}}
									onStop={(currentClaw) => {
										void handleStopClaw(currentClaw)
									}}
									onUpgradeClaw={handleConfirmUpgradeClaw}
									t={t}
								/>
							)
						})
					)}
				</div>
			</section>
		</>
	)
}
