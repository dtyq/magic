import { useCallback, useEffect, useRef, useState } from "react"
import { Check, CirclePlus, Loader2 } from "lucide-react"
import { observer } from "mobx-react-lite"
import { useTranslation } from "react-i18next"
import { Button } from "@/components/shadcn-ui/button"
import { ScrollArea } from "@/components/shadcn-ui/scroll-area"
import { useConfirmDialog } from "@/components/shadcn-composed/confirm-dialog"
import { CrewDetailDialog } from "@/pages/superMagic/components/CrewDetailDialog"
import useNavigate from "@/routes/hooks/useNavigate"
import { RouteName } from "@/routes/constants"
import { RoutePath } from "@/constants/routes"
import { configStore } from "@/models/config"
import { userStore } from "@/models/user"
import PageTopBar from "@/pages/superMagic/components/PageTopBar"
import { crewService } from "@/services/crew/CrewService"
import { defaultClusterCode } from "@/routes/helpers"
import { fillRoute } from "@/routes/history/helpers"
import { CREW_EDIT_STEP } from "@/pages/superMagic/pages/CrewEdit/store"
import { useAutoLoadMoreSentinel } from "@/pages/superMagic/hooks/useAutoLoadMoreSentinel"
import { useDelayedVisibility } from "@/pages/superMagic/hooks/useDelayedVisibility"
import {
	UserWorkspaceMapCache,
	WorkspaceStateCache,
} from "@/pages/superMagic/utils/superMagicCache"
import { MyCrewStore } from "./stores/my-crew"
import CreatedCrewCard from "./components/CreatedCrewCard"
import HiredCrewCard from "./components/HiredCrewCard"
import MyCrewCrewTypeTabs, { type MyCrewCrewTypeTab } from "./components/MyCrewCrewTypeTabs"
import type { MyCrewView } from "@/services/crew/CrewService"
import {
	resolveMyCrewDisableActionDisabled,
	resolveMyCrewDisableActionLabel,
	resolveMyCrewHiredActionKind,
} from "./components/my-crew-card-shared"

function MyCrewPage() {
	const { t } = useTranslation("crew/market")
	const navigate = useNavigate()
	const clusterCode = configStore.cluster.clusterCode || defaultClusterCode
	const storeRef = useRef(new MyCrewStore())
	const scrollViewportRef = useRef<HTMLDivElement | null>(null)
	const store = storeRef.current
	const [isCreating, setIsCreating] = useState(false)
	const [crewTypeTab, setCrewTypeTab] = useState<MyCrewCrewTypeTab>("created")
	const [selectedAgent, setSelectedAgent] = useState<MyCrewView | null>(null)
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

	async function handleCreateCrew() {
		if (isCreating) return
		setIsCreating(true)
		try {
			const { code } = await crewService.createDefaultAgent()
			navigate({ name: RouteName.CrewEdit, params: { id: code } })
		} catch {
			// Error handled by service / UI
		} finally {
			setIsCreating(false)
		}
	}

	const handleEdit = useCallback(
		(agentCode: string) => {
			navigate({ name: RouteName.CrewEdit, params: { id: agentCode } })
		},
		[navigate],
	)

	const handleCrewCardNavigate = useCallback(
		(agentCode: string, event: React.MouseEvent<HTMLElement>) => {
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
			navigate({ name: RouteName.CrewEdit, params: { id: agentCode } })
		},
		[navigate],
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

	const handleOpenPublishPanel = useCallback(
		(agentCode: string) => {
			navigate({
				name: RouteName.CrewEdit,
				params: { id: agentCode },
				query: {
					panel: CREW_EDIT_STEP.Publishing,
				},
			})
		},
		[navigate],
	)

	function resolveFallbackWorkspaceId() {
		const userInfo = userStore.user.userInfo
		const cachedWorkspaceState = WorkspaceStateCache.get(userInfo)
		return cachedWorkspaceState.workspaceId || UserWorkspaceMapCache.get(userInfo)
	}

	const handleOpenConversation = useCallback(
		(agentCode: string) => {
			const fallbackWorkspaceId = resolveFallbackWorkspaceId()
			navigate({
				name: fallbackWorkspaceId ? RouteName.SuperWorkspaceState : RouteName.Super,
				params: fallbackWorkspaceId
					? {
							workspaceId: fallbackWorkspaceId,
						}
					: undefined,
				query: {
					agentCode,
				},
			})
		},
		[navigate],
	)

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
									testId: "my-crew-detail-dismiss-button",
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
									testId: "my-crew-detail-disable-button",
									onClick: () => handleDisableHiredCrew(selectedAgent.agentCode),
								}
						: undefined
				}
			/>
			{dialog}
			<div
				className="flex h-full min-h-0 w-full min-w-0 flex-col overflow-hidden rounded-xl border border-border bg-background shadow-xs"
				data-testid="my-crew-page"
			>
				{/* Top header bar */}
				<PageTopBar data-testid="my-crew-top-bar" backButtonTestId="my-crew-back-button" />

				{/* Main scrollable section */}
				<ScrollArea className="min-h-0 flex-1" viewportRef={scrollViewportRef}>
					<div className="mx-auto flex w-full min-w-0 max-w-6xl flex-col gap-5 px-4 py-5 sm:gap-6 sm:px-6 sm:py-7">
						{/* Title + action buttons */}
						<div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
							<div className="flex min-w-0 flex-1 flex-col gap-2">
								<h1 className="break-words text-2xl leading-tight text-foreground sm:text-3xl lg:text-4xl">
									{t("myCrewPage.title")}
								</h1>
								<p className="max-w-2xl break-words text-sm text-muted-foreground">
									{t("myCrewPage.subtitle")}
								</p>
							</div>
							<div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:justify-end">
								<Button
									className="h-9 flex-1 gap-2 shadow-xs sm:flex-none"
									onClick={handleCreateCrew}
									disabled={isCreating}
									data-testid="my-crew-create-button"
								>
									{isCreating ? (
										<Loader2 className="h-4 w-4 animate-spin" />
									) : (
										<CirclePlus className="h-4 w-4" />
									)}
									{t("createCrew")}
								</Button>
							</div>
						</div>

						<MyCrewCrewTypeTabs
							value={crewTypeTab}
							onChange={setCrewTypeTab}
							className="max-w-md sm:max-w-lg"
						/>

						{/* Loading state */}
						{store.loading && (
							<div
								className="flex items-center justify-center py-16"
								data-testid="my-crew-loading"
							>
								<Loader2 className="size-6 animate-spin text-muted-foreground" />
							</div>
						)}

						{/* Empty state */}
						{store.isEmpty && (
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
									disabled={isCreating}
									className="gap-2"
								>
									{isCreating ? (
										<Loader2 className="h-4 w-4 animate-spin" />
									) : (
										<CirclePlus className="h-4 w-4" />
									)}
									{t("createCrew")}
								</Button>
							</div>
						)}

						{/* Crew card grid */}
						{!store.loading && store.list.length > 0 && (
							<>
								<div
									className="grid grid-cols-1 items-stretch gap-x-3 gap-y-14 pt-12 md:grid-cols-2 lg:grid-cols-4"
									data-testid="my-crew-card-grid"
								>
									{store.list.map((employee) =>
										crewTypeTab === "created" ? (
											<CreatedCrewCard
												key={employee.id}
												employee={employee}
												href={getCrewEditHref(employee.agentCode)}
												onNavigate={(event) =>
													handleCrewCardNavigate(
														employee.agentCode,
														event,
													)
												}
												onEdit={handleEdit}
												onConversation={handleOpenConversation}
												onUpgrade={handleUpgrade}
												onPublishToStore={handleOpenPublishPanel}
												onDelete={handleDeleteCreatedCrew}
											/>
										) : (
											<HiredCrewCard
												key={employee.id}
												employee={employee}
												href={getCrewEditHref(employee.agentCode)}
												onEdit={handleOpenDetails}
												onConversation={handleOpenConversation}
												onDismiss={handleDismissHiredCrew}
												onDisable={handleDisableHiredCrew}
											/>
										),
									)}
								</div>

								<div
									ref={loadMoreSentinelRef}
									className="h-1 w-full"
									data-testid="my-crew-scroll-sentinel"
								/>

								{shouldShowLoadingMoreIndicator ? (
									<div
										className="flex items-center justify-center py-2"
										data-testid="my-crew-loading-more"
									>
										<Loader2 className="size-4 animate-spin text-muted-foreground" />
									</div>
								) : null}

								{!store.hasMore ? (
									<div
										className="flex items-center justify-center gap-1 py-2 opacity-30"
										data-testid="my-crew-no-more"
									>
										<Check className="size-4" />
										<span className="text-xs">
											{t("skillsLibrary.noMoreData")}
										</span>
									</div>
								) : null}
							</>
						)}
					</div>
				</ScrollArea>
			</div>
		</>
	)
}

export default observer(MyCrewPage)
