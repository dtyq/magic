import { useEffect, useState, type KeyboardEvent, type ReactNode } from "react"
import { observer } from "mobx-react-lite"
import { Plus, Unplug, X } from "lucide-react"
import { IconLoader2 } from "@tabler/icons-react"
import { useCreation, useMemoizedFn } from "ahooks"
import { InfiniteScroll } from "antd-mobile"
import MagicPopup from "@/components/base-mobile/MagicPopup"
import MagicImage from "@/components/base/MagicImage"
import { useTranslation } from "react-i18next"
import type { MCPButtonProps } from "./MCPButton"
import type { IMCPItem } from "../types"
import { getMCPAccess, loadMCPWithInstalledConnectorReconciliation } from "../store/mcp-access"
import { mcpEnabledStore } from "../store/mcp-enabled-store"
import { Switch } from "@/components/shadcn-ui/switch"
import { Button } from "@/components/shadcn-ui/button"
import { ScrollArea } from "@/components/shadcn-ui/scroll-area"
import { IconMCP } from "@/enhance/tabler/icons-react"
import { MobileShellIconButton } from "@/pages/superMagicMobile/components/MobileShell"
import { SmoothTabs, type Tab } from "@/components/shadcn-ui/smooth-tabs"
import {
	CONNECTOR_MARKET_GROUPS,
	type ConnectorMarketGroup,
} from "@/pages/superMagic/pages/ConnectorMarket/components/ConnectorCategoryFilter"
import { useConnectorMarket } from "@/pages/superMagic/pages/ConnectorMarket/hooks/useConnectorMarket"
import { useConnectorActions } from "@/pages/superMagic/pages/ConnectorMarket/hooks/useConnectorActions"
import { ConnectorAuthDialog } from "../AgentSettings/AgentPanel/MCPPanel/helpers"
import ConnectorCreateDialog from "@/pages/superMagic/pages/ConnectorMarket/components/ConnectorCreateDialog"
import ConnectorDetailDialog from "@/pages/superMagic/pages/ConnectorMarket/components/ConnectorDetailDialog"
import magicToast from "@/components/base/MagicToaster/utils"

interface MobileMCPPluginsSheetProps {
	open: boolean
	onClose: () => void
	storageKey?: MCPButtonProps["storageKey"]
	useTempStorage?: boolean
}

function MobileMCPConnectorItem({
	item,
	action,
	onOpenDetail,
}: {
	item: IMCPItem
	action: ReactNode
	onOpenDetail?: (item: IMCPItem) => void
}) {
	const { t } = useTranslation("agent")
	const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
		if (!onOpenDetail || (event.key !== "Enter" && event.key !== " ")) return
		event.preventDefault()
		onOpenDetail(item)
	}

	return (
		<div
			className={`flex items-center gap-2.5 rounded-md px-3 py-2.5 transition-colors hover:bg-accent/60${onOpenDetail ? " cursor-pointer" : ""}`}
			onClick={() => onOpenDetail?.(item)}
			onKeyDown={handleKeyDown}
			role={onOpenDetail ? "button" : undefined}
			tabIndex={onOpenDetail ? 0 : undefined}
			data-testid="mobile-mcp-plugins-sheet-item"
		>
			<div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-lg">
				<MagicImage
					className="h-9 w-9 overflow-hidden rounded-lg"
					src={item.icon}
					alt={item.name}
					fallback={
						<div className="h-9 w-9 overflow-hidden rounded-lg">
							<IconMCP size="100%" />
						</div>
					}
				/>
			</div>
			<div className="min-w-0 flex-1">
				<div className="line-clamp-1 text-sm font-medium leading-5 text-foreground">
					{item.name}
				</div>
				<div className="line-clamp-2 text-xs leading-4 text-muted-foreground">
					{item.description || t("mcp.card.desc")}
				</div>
			</div>
			<div
				className="flex shrink-0 items-center self-center"
				onClick={(event) => event.stopPropagation()}
			>
				{action}
			</div>
		</div>
	)
}

function MobileMCPMarketItem({
	item,
	selected,
	loading,
	onOpenDetail,
	onToggle,
}: {
	item: IMCPItem
	selected: boolean
	loading: boolean
	onOpenDetail: (item: IMCPItem) => void
	onToggle: (item: IMCPItem) => void
}) {
	const { t: tMarket } = useTranslation("crew/market")

	return (
		<MobileMCPConnectorItem
			item={item}
			onOpenDetail={onOpenDetail}
			action={
				<Button
					variant={selected ? "secondary" : "default"}
					size="sm"
					className={`h-8 shrink-0 px-3 text-xs${selected ? " bg-destructive/10 text-destructive hover:bg-destructive/15" : ""}`}
					disabled={loading}
					onClick={() => onToggle(item)}
					data-testid="mobile-mcp-market-item-toggle"
				>
					{loading ? <IconLoader2 className="size-4 animate-spin" /> : null}
					{!loading
						? selected
							? tMarket("connectors.remove")
							: tMarket("connectors.installShort")
						: null}
				</Button>
			}
		/>
	)
}

function MobileMCPPluginsSheet({
	open,
	onClose,
	storageKey,
	useTempStorage = false,
}: MobileMCPPluginsSheetProps) {
	const { t } = useTranslation("agent")
	const { t: tMarket } = useTranslation("crew/market")
	const [activeTab, setActiveTab] = useState<ConnectorMarketGroup>(CONNECTOR_MARKET_GROUPS.added)
	const [enabledMCPIds, setEnabledMCPIds] = useState<Set<string>>(() => new Set())
	const [switchLoadingIds, setSwitchLoadingIds] = useState<Set<string>>(() => new Set())
	const [selectedConnector, setSelectedConnector] = useState<IMCPItem | null>(null)
	const [createDialogOpen, setCreateDialogOpen] = useState(false)
	const addedMCPAccess = useCreation(() => getMCPAccess({ storageKey: "__added__" }), [])
	const activeMCPAccess = useCreation(
		() => getMCPAccess({ storageKey, useTempStorage }),
		[storageKey, useTempStorage],
	)
	const activeStorageKey = storageKey || "__template_project_id__"
	const {
		selectedItems,
		selectedIds,
		loadingIds,
		authDialog,
		handleAuthDialogSuccess,
		handleAuthDialogRevoked,
		handleAuthDialogOpenChange,
		onStatusChange,
	} = useConnectorActions({ activeAccess: activeMCPAccess })
	const {
		list: marketList,
		loading: marketLoading,
		loadingMoreError: marketLoadingMoreError,
		hasMore: marketHasMore,
		error: marketError,
		retry: retryMarket,
		loadMore: loadMoreMarket,
	} = useConnectorMarket("", activeTab, selectedItems, open)

	useEffect(() => {
		let cancelled = false
		setEnabledMCPIds(new Set())
		mcpEnabledStore.setEnabledIds([])

		const loadMCPSettings = async () => {
			if (!useTempStorage) {
				try {
					await loadMCPWithInstalledConnectorReconciliation({
						installedAccess: addedMCPAccess,
						activeAccess: activeMCPAccess,
						activeStorageKey,
					})
				} catch (error) {
					console.error(error)
				}
			} else {
				try {
					await Promise.all([addedMCPAccess.load(), activeMCPAccess.load()])
				} catch (error) {
					console.error(error)
				}
			}
			if (cancelled) return
		}

		void loadMCPSettings()
		return () => {
			cancelled = true
		}
	}, [activeMCPAccess, activeStorageKey, addedMCPAccess, useTempStorage])

	const displayMCPList = addedMCPAccess.mcpList
	const activeMCPIds = activeMCPAccess.mcpList.map((item) => item.id).join(",")
	// Only show the full-list loading state during the first initialization.
	// MCPStore briefly toggles `loading` while persisting a switch change; that
	// background refresh should not replace the already rendered list.
	const initialLoading = !addedMCPAccess.initialized || !activeMCPAccess.initialized
	const tabs = [
		{
			value: CONNECTOR_MARKET_GROUPS.added,
			label: tMarket("connectors.addedList"),
			testId: "mobile-mcp-plugins-sheet-added-tab",
		},
		{
			value: CONNECTOR_MARKET_GROUPS.official,
			label: tMarket("connectors.official"),
			testId: "mobile-mcp-plugins-sheet-official-tab",
		},
		{
			value: CONNECTOR_MARKET_GROUPS.mine,
			label: tMarket("connectors.mine"),
			testId: "mobile-mcp-plugins-sheet-mine-tab",
		},
	] satisfies Tab<ConnectorMarketGroup>[]

	const toggleMCPEnabled = useMemoizedFn(async (id: string, enabled: boolean) => {
		if (switchLoadingIds.has(id)) return
		const nextIds = new Set(enabledMCPIds)
		if (enabled) nextIds.add(id)
		else nextIds.delete(id)
		const currentActiveIds = new Set(activeMCPAccess.mcpList.map((item) => item.id))
		if (enabled) currentActiveIds.add(id)
		else currentActiveIds.delete(id)
		setSwitchLoadingIds((current) => new Set(current).add(id))
		setEnabledMCPIds(nextIds)
		mcpEnabledStore.setEnabledIds(currentActiveIds)
		try {
			await activeMCPAccess.save({
				selectedIds: currentActiveIds,
				items: displayMCPList,
			})
		} catch (error) {
			console.error(error)
			const fallbackIds = new Set(activeMCPAccess.mcpList.map((item) => item.id))
			setEnabledMCPIds(fallbackIds)
			mcpEnabledStore.setEnabledIds(fallbackIds)
		} finally {
			setSwitchLoadingIds((current) => {
				const next = new Set(current)
				next.delete(id)
				return next
			})
		}
	})

	useEffect(() => {
		if (!activeMCPAccess.initialized) return
		const ids = activeMCPAccess.mcpList.map((item) => item.id)
		setEnabledMCPIds(new Set(ids))
		mcpEnabledStore.setEnabledIds(ids)
	}, [activeMCPAccess.initialized, activeMCPIds])

	const openConnectorCreate = useMemoizedFn(() => {
		setCreateDialogOpen(true)
	})

	const openConnectorDetail = useMemoizedFn((item: IMCPItem) => {
		setSelectedConnector(item)
	})

	return (
		<MagicPopup
			visible={open}
			onClose={onClose}
			className="rounded-t-[14px] border-0 bg-muted shadow-[0_-4px_24px_rgba(0,0,0,0.08)]"
			bodyClassName="rounded-t-[14px] border-0 bg-muted p-0 overflow-hidden"
			handlerClassName="bg-muted-foreground mb-1.5 h-1 w-20 rounded-full"
			title={t("mcp.button.text")}
		>
			{authDialog ? (
				<ConnectorAuthDialog
					open
					{...authDialog}
					zIndex={1200}
					onSuccess={handleAuthDialogSuccess}
					onAuthRevoked={handleAuthDialogRevoked}
					onOpenChange={handleAuthDialogOpenChange}
				/>
			) : null}
			<ConnectorCreateDialog
				open={createDialogOpen}
				zIndex={1200}
				onOpenChange={setCreateDialogOpen}
				onSuccess={() => {
					setCreateDialogOpen(false)
					magicToast.success(tMarket("connectors.createSuccess"))
					if (activeTab === CONNECTOR_MARKET_GROUPS.mine) void retryMarket()
					else setActiveTab(CONNECTOR_MARKET_GROUPS.mine)
				}}
			/>
			<ConnectorDetailDialog
				open={selectedConnector != null}
				onOpenChange={(nextOpen) => {
					if (!nextOpen) setSelectedConnector(null)
				}}
				connector={selectedConnector}
				selected={selectedConnector ? selectedIds.has(selectedConnector.id) : false}
				loading={selectedConnector ? loadingIds.has(selectedConnector.id) : false}
				onToggle={onStatusChange}
			/>
			<div
				className="flex h-[min(640px,calc(100vh-var(--safe-area-inset-top)-var(--safe-area-inset-bottom)-44px))] min-h-0 w-full flex-col overflow-hidden bg-muted"
				data-testid="mobile-mcp-plugins-sheet"
			>
				<div className="relative z-10 flex h-14 w-full shrink-0 items-center justify-center px-20 py-2">
					<button
						type="button"
						onClick={onClose}
						className="absolute left-2.5 top-1/2 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-card shadow-[0px_8px_25px_0px_rgba(0,0,0,0.10)]"
						aria-label={t("common.auth.cancel")}
						data-testid="mobile-mcp-plugins-sheet-close-button"
					>
						<X className="h-[22px] w-[22px] text-foreground" />
					</button>

					<div className="max-w-[220px] truncate text-center text-lg font-medium leading-6 text-foreground">
						{t("mcp.button.text")}
					</div>

					<MobileShellIconButton
						label={tMarket("connectors.create")}
						onClick={openConnectorCreate}
						testId="mobile-mcp-plugins-sheet-add-more-button"
						className="absolute right-2.5 top-1/2 -translate-y-1/2"
					>
						<Plus size={22} />
					</MobileShellIconButton>
				</div>

				<div className="relative z-40 flex shrink-0 justify-start px-3 pt-4">
					<SmoothTabs
						tabs={tabs}
						value={activeTab}
						onChange={setActiveTab}
						variant="background"
						showTooltip={false}
						enableHoverBackground={false}
						className="h-9 w-max max-w-full rounded-full bg-muted-foreground/15 p-[3px]"
						buttonClassName="h-[30px] flex-none rounded-full px-4 text-[14px] leading-5 data-[state=active]:font-medium data-[state=active]:text-foreground data-[state=inactive]:font-normal data-[state=inactive]:text-muted-foreground"
						indicatorClassName="inset-y-[3px] rounded-full border-0 bg-card shadow-[0px_8px_25px_0px_rgba(0,0,0,0.10)]"
						data-testid="mobile-mcp-plugins-sheet-tabs"
					/>
				</div>

				<div className="flex min-h-0 flex-1 flex-col overflow-hidden">
					{activeTab === CONNECTOR_MARKET_GROUPS.added && initialLoading ? (
						<div
							className="flex min-h-0 flex-1 items-center justify-center"
							data-testid="mobile-mcp-plugins-sheet-loading"
						>
							<IconLoader2 className="size-5 animate-spin text-muted-foreground" />
						</div>
					) : activeTab === CONNECTOR_MARKET_GROUPS.added ? (
						<ScrollArea
							className="min-h-0 flex-1"
							viewportClassName="pl-1.5 pr-3 py-3 [&>div]:!block [&>div]:min-h-full"
						>
							{displayMCPList.length > 0 ? (
								<div className="flex flex-col gap-2">
									{displayMCPList.map((item) => (
										<MobileMCPConnectorItem
											key={item.id}
											item={item}
											onOpenDetail={openConnectorDetail}
											action={
												<Switch
													aria-label={t("mcp.button.toggleConnector", {
														name: item.name,
													})}
													checked={enabledMCPIds.has(item.id)}
													loading={switchLoadingIds.has(item.id)}
													className="h-[28px] w-[48px] translate-y-0 self-center data-[state=checked]:bg-foreground data-[state=unchecked]:bg-border [&_[data-slot=switch-thumb][data-state=checked]]:translate-x-[calc(100%-2px)] [&_[data-slot=switch-thumb]]:size-6 [&_[data-slot=switch-thumb]]:translate-y-0 [&_[data-slot=switch-thumb]]:bg-background"
													onCheckedChange={(checked) =>
														void toggleMCPEnabled(item.id, checked)
													}
												/>
											}
										/>
									))}
								</div>
							) : (
								<div
									className="flex min-h-full flex-col items-center justify-center gap-2 px-4 text-center"
									data-testid="mobile-mcp-plugins-sheet-empty"
								>
									<Unplug
										className="size-[42px] text-muted-foreground"
										aria-hidden="true"
									/>
									<div className="text-base text-muted-foreground">
										{t("mcp.button.emptyConnectors")}
									</div>
									<Button
										variant="default"
										size="lg"
										className="mt-3 rounded-full"
										onClick={() =>
											setActiveTab(CONNECTOR_MARKET_GROUPS.official)
										}
										data-testid="mobile-mcp-plugins-sheet-add-more-connectors"
									>
										<Plus className="size-4" />
										{t("mcp.button.addMoreConnectors")}
									</Button>
								</div>
							)}
						</ScrollArea>
					) : marketLoading && marketList.length === 0 ? (
						<div
							className="flex min-h-0 flex-1 items-center justify-center"
							data-testid="mobile-mcp-market-loading"
						>
							<IconLoader2 className="size-5 animate-spin text-muted-foreground" />
						</div>
					) : marketError ? (
						<div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-3 px-4 text-center">
							<div className="text-sm text-muted-foreground">
								{tMarket("connectors.loadFailed")}
							</div>
							<Button variant="outline" size="sm" onClick={retryMarket}>
								{tMarket("connectors.retry")}
							</Button>
						</div>
					) : (
						<ScrollArea
							className="min-h-0 flex-1"
							viewportClassName="pl-1.5 pr-3 py-3 [&>div]:!block [&>div]:min-h-full"
						>
							{marketList.length > 0 ? (
								<>
									<div className="flex flex-col gap-2">
										{marketList.map((item) => (
											<MobileMCPMarketItem
												key={item.id}
												item={item}
												selected={selectedIds.has(item.id)}
												loading={loadingIds.has(item.id)}
												onOpenDetail={openConnectorDetail}
												onToggle={(connector) =>
													void onStatusChange(connector)
												}
											/>
										))}
									</div>
									{marketLoadingMoreError ? (
										<div className="flex items-center justify-center gap-2 py-2 text-xs text-destructive">
											<span>{tMarket("connectors.loadFailed")}</span>
											<Button
												variant="ghost"
												size="sm"
												className="h-7 px-2"
												onClick={loadMoreMarket}
											>
												{tMarket("connectors.retry")}
											</Button>
										</div>
									) : null}
									{/* Official and mine lists are server-paginated; the added list is local. */}
									<InfiniteScroll
										hasMore={marketHasMore}
										loadMore={loadMoreMarket}
									/>
								</>
							) : (
								<div className="flex min-h-[180px] items-center justify-center text-sm text-muted-foreground">
									{tMarket("connectors.empty")}
								</div>
							)}
						</ScrollArea>
					)}
				</div>
			</div>
		</MagicPopup>
	)
}

export default observer(MobileMCPPluginsSheet)
