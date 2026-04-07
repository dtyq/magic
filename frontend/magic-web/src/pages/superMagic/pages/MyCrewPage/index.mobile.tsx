import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { ChevronLeft, CirclePlus, Loader2 } from "lucide-react"
import { observer } from "mobx-react-lite"
import { useTranslation } from "react-i18next"
import { Button } from "@/components/shadcn-ui/button"
import { ScrollArea } from "@/components/shadcn-ui/scroll-area"
import { useConfirmDialog } from "@/components/shadcn-composed/confirm-dialog"
import { CrewDetailDialog } from "@/pages/superMagic/components/CrewDetailDialog"
import PcOnlyNoticeDialog from "@/pages/superMagic/components/PcOnlyNoticeDialog"
import ActionsPopupComponent from "@/pages/superMagicMobile/components/ActionsPopup"
import type { ActionsPopup } from "@/pages/superMagicMobile/components/ActionsPopup/types"
import useNavigate from "@/routes/hooks/useNavigate"
import { RoutePath } from "@/constants/routes"
import { configStore } from "@/models/config"
import { defaultClusterCode } from "@/routes/helpers"
import { fillRoute } from "@/routes/history/helpers"
import { ViewTransitionPresets } from "@/types/viewTransition"
import { useAutoLoadMoreSentinel } from "@/pages/superMagic/hooks/useAutoLoadMoreSentinel"
import { useDelayedVisibility } from "@/pages/superMagic/hooks/useDelayedVisibility"
import MyCrewCardMobile from "./components/MyCrewCardMobile"
import MyCrewCrewTypeTabs, { type MyCrewCrewTypeTab } from "./components/MyCrewCrewTypeTabs"
import { MyCrewStore } from "./stores/my-crew"
import type { MyCrewView } from "@/services/crew/CrewService"
import {
	resolveMyCrewDisableActionDisabled,
	resolveMyCrewDisableActionLabel,
	resolveMyCrewHiredActionKind,
} from "./components/my-crew-card-shared"

function MyCrewPageMobile() {
	const { t } = useTranslation("crew/market")
	const navigate = useNavigate()
	const clusterCode = configStore.cluster.clusterCode || defaultClusterCode
	const storeRef = useRef(new MyCrewStore())
	const scrollViewportRef = useRef<HTMLDivElement | null>(null)
	const store = storeRef.current

	const [crewTypeTab, setCrewTypeTab] = useState<MyCrewCrewTypeTab>("created")
	const [pcOnlyDialogOpen, setPcOnlyDialogOpen] = useState(false)
	const [selectedAgent, setSelectedAgent] = useState<MyCrewView | null>(null)
	const [selectedActionAgent, setSelectedActionAgent] = useState<MyCrewView | null>(null)
	const handleAutoLoadMore = useCallback(() => {
		void store.loadMore()
	}, [store])
	const loadMoreSentinelRef = useAutoLoadMoreSentinel({
		rootRef: scrollViewportRef,
		disabled: store.loading || store.loadingMore || !store.hasMore,
		onLoadMore: handleAutoLoadMore,
	})
	const shouldShowLoadingMoreIndicator = useDelayedVisibility({
		visible: store.loadingMore,
	})

	useEffect(() => {
		store.fetchAgents({ listVariant: crewTypeTab })
		return () => store.reset()
	}, [crewTypeTab, store])

	const showPcOnlyNotice = useCallback(() => setPcOnlyDialogOpen(true), [])

	function handleCreateCrew() {
		showPcOnlyNotice()
	}

	const handleEdit = useCallback(
		(agentCode: string) => {
			void agentCode
			showPcOnlyNotice()
		},
		[showPcOnlyNotice],
	)

	const handleCrewCardNavigate = useCallback(
		(agentCode: string, event: React.MouseEvent<HTMLAnchorElement>) => {
			void agentCode
			if (
				event.button !== 0 ||
				event.metaKey ||
				event.ctrlKey ||
				event.shiftKey ||
				event.altKey
			) {
				return
			}
			event.preventDefault()
			showPcOnlyNotice()
		},
		[showPcOnlyNotice],
	)

	const getCrewEditHref = useCallback(
		(agentCode: string) =>
			fillRoute(`/:clusterCode${RoutePath.CrewEdit}`, {
				clusterCode,
				id: agentCode,
			}) || "#",
		[clusterCode],
	)

	const { confirm, dialog } = useConfirmDialog()

	const handleDeleteCreatedCrew = useCallback(
		(agentCode: string) => {
			const employee = store.list.find((e) => e.agentCode === agentCode)
			const displayName = employee?.name?.trim() || t("crew/create:untitledCrew") || agentCode
			confirm({
				title: t("myCrewPage.deleteConfirm.title", { name: displayName }),
				description: t("myCrewPage.deleteConfirm.description"),
				confirmText: t("myCrewPage.deleteConfirm.confirm"),
				variant: "destructive",
				destructivePresentation: "soft",
				dialogSize: "sm",
				onConfirm: () => store.deleteAgent(agentCode),
			})
		},
		[store, t, confirm],
	)

	const handleDismissHiredCrew = useCallback(
		(agentCode: string) => {
			const employee = store.list.find((e) => e.agentCode === agentCode)
			if (!employee?.allowDelete) return
			const displayName = employee?.name?.trim() || t("crew/create:untitledCrew") || agentCode
			confirm({
				title: t("myCrewPage.dismissConfirm.title", { name: displayName }),
				description: t("myCrewPage.dismissConfirm.description"),
				confirmText: t("myCrewPage.dismissConfirm.confirm"),
				variant: "destructive",
				destructivePresentation: "soft",
				dialogSize: "sm",
				onConfirm: () => store.deleteAgent(agentCode),
			})
		},
		[store, t, confirm],
	)

	const handleDisableHiredCrew = useCallback(
		(agentCode: string) => {
			const employee = store.list.find((e) => e.agentCode === agentCode)
			if (!employee?.enabled) return
			const displayName = employee?.name?.trim() || t("crew/create:untitledCrew") || agentCode
			confirm({
				title: t("myCrewPage.disableConfirm.title", { name: displayName }),
				description: t("myCrewPage.disableConfirm.description"),
				confirmText: t("myCrewPage.disableConfirm.confirm"),
				variant: "destructive",
				destructivePresentation: "soft",
				dialogSize: "sm",
				onConfirm: () => store.offlineAgent(agentCode),
			})
		},
		[store, t, confirm],
	)

	const handleUpgrade = useCallback(
		(agentCode: string) => {
			store.upgradeAgent(agentCode)
		},
		[store],
	)

	const handleOpenDetails = useCallback(
		(agentCode: string) => {
			const target = store.list.find((item) => item.agentCode === agentCode)
			if (!target) return
			setSelectedAgent(target)
		},
		[store],
	)

	const handleOpenActions = useCallback((employee: MyCrewView) => {
		setSelectedActionAgent(employee)
	}, [])

	const handleBack = useCallback(() => {
		navigate({
			delta: -1,
			viewTransition: ViewTransitionPresets.slideRight,
		})
	}, [navigate])

	const mobileActions = useMemo<ActionsPopup.ActionButtonConfig[]>(() => {
		if (!selectedActionAgent) return []

		const actions: ActionsPopup.ActionButtonConfig[] = []

		if (selectedActionAgent.needUpgrade) {
			actions.push({
				key: "upgrade",
				label: t("skillsLibrary.upgrade"),
				onClick: () => {
					setSelectedActionAgent(null)
					handleUpgrade(selectedActionAgent.agentCode)
				},
				"data-testid": "my-crew-mobile-action-upgrade",
			})
		}

		actions.push({
			key: "delete",
			label: t("myCrewPage.delete"),
			variant: "danger",
			onClick: () => {
				setSelectedActionAgent(null)
				handleDeleteCreatedCrew(selectedActionAgent.agentCode)
			},
			"data-testid": "my-crew-mobile-action-delete",
		})

		return actions
	}, [handleDeleteCreatedCrew, handleUpgrade, selectedActionAgent, t])

	return (
		<>
			<CrewDetailDialog
				open={selectedAgent != null}
				onOpenChange={(open) => {
					if (!open) setSelectedAgent(null)
				}}
				agentCode={selectedAgent?.agentCode ?? null}
				detailSource={selectedAgent?.sourceType === "MARKET" ? "market" : "employee"}
				versionCode={selectedAgent?.latestVersionCode}
				avatarUrl={selectedAgent?.icon}
				primaryAction={
					selectedAgent != null
						? resolveMyCrewHiredActionKind(selectedAgent.sourceType) === "dismiss"
							? {
									label: t("dismiss"),
									variant: "destructive",
									testId: "my-crew-mobile-detail-dismiss-button",
									onClick: () => handleDismissHiredCrew(selectedAgent.agentCode),
								}
							: {
									label: resolveMyCrewDisableActionLabel(
										selectedAgent.allowDelete,
										t,
									),
									variant: "secondary",
									disabled: resolveMyCrewDisableActionDisabled(
										selectedAgent.allowDelete,
										selectedAgent.enabled,
									),
									testId: "my-crew-mobile-detail-disable-button",
									onClick: () => handleDisableHiredCrew(selectedAgent.agentCode),
								}
						: undefined
				}
			/>
			{dialog}
			<PcOnlyNoticeDialog
				open={pcOnlyDialogOpen}
				onOpenChange={setPcOnlyDialogOpen}
				title={t("myCrewPage.pcOnlyNotice.title")}
				description={t("myCrewPage.pcOnlyNotice.description")}
				confirmText={t("myCrewPage.pcOnlyNotice.confirm")}
				testIdPrefix="my-crew-pc-only"
			/>
			<ActionsPopupComponent
				visible={selectedActionAgent != null}
				title={t("myCrewPage.moreActionsAria")}
				actions={mobileActions}
				onClose={() => setSelectedActionAgent(null)}
			/>
			<div
				className="flex h-full min-h-0 w-full min-w-0 flex-col overflow-hidden border border-t-0 border-border bg-background shadow-xs"
				data-testid="my-crew-page-mobile"
			>
				<header
					data-testid="my-crew-mobile-top-bar"
					className="relative flex h-12 shrink-0 items-center rounded-b-xl bg-background px-2.5 shadow-xs"
				>
					<Button
						variant="ghost"
						size="icon"
						className="z-10 size-8 shrink-0 rounded-lg"
						onClick={handleBack}
						aria-label={t("back")}
						data-testid="my-crew-back-button"
					>
						<ChevronLeft className="size-6" aria-hidden />
					</Button>
					<h1 className="pointer-events-none absolute inset-0 flex items-center justify-center truncate px-24 text-center text-base font-medium leading-6 text-foreground">
						{t("myCrewPage.title")}
					</h1>
					<div className="z-10 ml-auto flex shrink-0">
						<Button
							variant="ghost"
							className="h-8 gap-1 rounded-md px-2 text-xs font-medium text-foreground"
							onClick={handleCreateCrew}
							data-testid="my-crew-create-button"
						>
							<CirclePlus className="size-4 shrink-0" aria-hidden />
							{t("createCrew")}
						</Button>
					</div>
				</header>

				<ScrollArea
					className="min-h-0 flex-1 [&_[data-slot='scroll-area-viewport']>div]:!block"
					viewportRef={scrollViewportRef}
				>
					<div className="flex min-w-0 flex-col gap-2.5 px-2 pb-8 pt-2">
						<MyCrewCrewTypeTabs value={crewTypeTab} onChange={setCrewTypeTab} />

						{store.loading ? (
							<div
								className="flex items-center justify-center py-16"
								data-testid="my-crew-loading"
							>
								<Loader2 className="size-6 animate-spin text-muted-foreground" />
							</div>
						) : null}

						{store.isEmpty ? (
							<div
								className="flex flex-col items-center justify-center gap-3 py-16 text-center"
								data-testid="my-crew-empty"
							>
								<p className="text-sm text-muted-foreground">
									{t("myCrewPage.empty")}
								</p>
								<Button
									variant="outline"
									size="sm"
									onClick={handleCreateCrew}
									className="gap-2"
								>
									<CirclePlus className="size-4" />
									{t("createCrew")}
								</Button>
							</div>
						) : null}

						{!store.loading && store.list.length > 0 ? (
							<>
								<div
									className="grid grid-cols-2 gap-x-2 gap-y-10 py-2.5"
									data-testid="my-crew-card-grid"
								>
									{store.list.map((employee) => (
										<MyCrewCardMobile
											key={employee.id}
											listVariant={crewTypeTab}
											employee={employee}
											href={getCrewEditHref(employee.agentCode)}
											onNavigate={(event) =>
												handleCrewCardNavigate(employee.agentCode, event)
											}
											onEdit={
												crewTypeTab === "created"
													? handleEdit
													: handleOpenDetails
											}
											onMoreClick={
												crewTypeTab === "created"
													? handleOpenActions
													: undefined
											}
											onUpgrade={handleUpgrade}
											{...(crewTypeTab === "hired"
												? {
														onDismiss: handleDismissHiredCrew,
														onDisable: handleDisableHiredCrew,
													}
												: { onDelete: handleDeleteCreatedCrew })}
										/>
									))}
								</div>

								<div
									ref={loadMoreSentinelRef}
									className="h-1 w-full"
									data-testid="my-crew-mobile-scroll-sentinel"
								/>

								{shouldShowLoadingMoreIndicator ? (
									<div
										className="flex items-center justify-center py-2"
										data-testid="my-crew-mobile-loading-more"
									>
										<Loader2 className="size-4 animate-spin text-muted-foreground" />
									</div>
								) : null}

								{!store.hasMore ? (
									<div
										className="flex items-center justify-center py-1.5 text-xs text-muted-foreground/60"
										data-testid="my-crew-mobile-no-more"
									>
										{t("skillsLibrary.noMoreData")}
									</div>
								) : null}
							</>
						) : null}
					</div>
				</ScrollArea>
			</div>
		</>
	)
}

export default observer(MyCrewPageMobile)
