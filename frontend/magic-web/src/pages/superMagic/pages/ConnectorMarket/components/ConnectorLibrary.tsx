import { Fragment, useCallback, useEffect, useMemo, useRef, useState, type RefObject } from "react"
import type { IMCPItem } from "@/components/Agent/MCP/types"
import { FlowApi } from "@/apis"
import { Check, Loader2, Plus, X } from "lucide-react"
import { useTranslation } from "react-i18next"
import { Button } from "@/components/shadcn-ui/button"
import { Input } from "@/components/shadcn-ui/input"
import { ScrollArea } from "@/components/shadcn-ui/scroll-area"
import { useConfirmDialog } from "@/components/shadcn-composed/confirm-dialog"
import { openAgentCommonModal } from "@/components/Agent/AgentCommonModal"
import AgentAuthorizationTools from "@/components/Agent/AgentTools/AgentAuthorizationTools/AgentAuthorizationTools"
import AuthManagerModal from "@/pages/flow/components/AuthControlButton/AuthManagerModal"
import { ResourceTypes } from "@/pages/flow/components/AuthControlButton/types"
import MarketStickyHeader from "@/pages/superMagic/pages/CrewMarket/components/MarketStickyHeader"
import SearchBar from "@/pages/superMagic/pages/CrewMarket/components/SearchBar"
import useNavigate from "@/routes/hooks/useNavigate"
import { RouteName } from "@/routes/constants"
import { useConnectorMarket } from "../hooks/useConnectorMarket"
import ConnectorCategoryFilter, {
	CONNECTOR_MARKET_GROUPS,
	type ConnectorMarketGroup,
} from "./ConnectorCategoryFilter"
import SkillMarketTabs, {
	SKILL_MARKET_TAB_VALUES,
} from "@/pages/superMagic/pages/SkillMarket/components/SkillMarketTabs"
import ConnectorCard from "./ConnectorCard"
import { useConnectorActions } from "../hooks/useConnectorActions"
import { getMCPAccess } from "@/components/Agent/MCP/store/mcp-access"
import ConnectorDetailDialog from "./ConnectorDetailDialog"
import { ConnectorAuthDialog } from "@/components/Agent/MCP/AgentSettings/AgentPanel/MCPPanel/helpers"
import ConnectorCreateDialog from "./ConnectorCreateDialog"
import magicToast from "@/components/base/MagicToaster/utils"
import { useAutoLoadMoreSentinel } from "@/pages/superMagic/hooks/useAutoLoadMoreSentinel"

interface ConnectorLibraryProps {
	scrollViewportRef?: RefObject<HTMLDivElement | null>
	embedded?: boolean
	activeStorageKey?: string
	useTempStorage?: boolean
	onClose?: () => void
	onNestedPanelOpenChange?: (open: boolean) => void
}

export default function ConnectorLibrary({
	scrollViewportRef,
	embedded = false,
	activeStorageKey,
	useTempStorage = false,
	onClose,
	onNestedPanelOpenChange,
}: ConnectorLibraryProps) {
	const { t } = useTranslation("crew/market")
	const { t: tAgent } = useTranslation("agent")
	const navigate = useNavigate()
	const activeAccess = useMemo(
		() =>
			embedded ? getMCPAccess({ storageKey: activeStorageKey, useTempStorage }) : undefined,
		[activeStorageKey, embedded, useTempStorage],
	)
	const [searchQuery, setSearchQuery] = useState("")
	const [selectedConnector, setSelectedConnector] = useState<IMCPItem | null>(null)
	const [editingConnector, setEditingConnector] = useState<IMCPItem | null>(null)
	const [permissionsConnectorId, setPermissionsConnectorId] = useState<string | null>(null)
	const [createDialogOpen, setCreateDialogOpen] = useState(false)
	const [group, setGroup] = useState<ConnectorMarketGroup>(CONNECTOR_MARKET_GROUPS.official)
	const { confirm, dialog } = useConfirmDialog()
	const {
		selectedItems,
		selectedIds,
		loadingIds,
		authDialog,
		handleAuthDialogSuccess,
		handleAuthDialogRevoked,
		handleAuthDialogOpenChange,
		onStatusChange,
	} = useConnectorActions({ activeAccess })
	const {
		list,
		loading,
		loadingMore,
		loadingMoreError,
		hasMore,
		error,
		retry,
		loadMore,
		removeItem,
		updateItem,
	} = useConnectorMarket(searchQuery, group, selectedItems)
	const ownViewportRef = useRef<HTMLDivElement | null>(null)
	const viewportRef = scrollViewportRef ?? ownViewportRef
	// The full market page already owns its ScrollArea; only embedded panels need a local one.
	const ListContainer = embedded ? ScrollArea : Fragment
	const [statusLoadingIds, setStatusLoadingIds] = useState<Set<string>>(new Set())
	const handleAutoLoadMore = useCallback(() => loadMore(), [loadMore])
	const sentinelRef = useAutoLoadMoreSentinel({
		rootRef: viewportRef,
		disabled: loading || loadingMore || !hasMore,
		onLoadMore: handleAutoLoadMore,
	})

	const openDetail = (connector: IMCPItem) => setSelectedConnector(connector)
	const editConnector = (connector: IMCPItem) => {
		setSelectedConnector(null)
		setEditingConnector(connector)
		setCreateDialogOpen(true)
	}
	const deleteConnector = useCallback(
		async (connector: IMCPItem) => {
			try {
				await FlowApi.deleteMcp(connector.id)
				magicToast.success(t("connectors.deleteSuccess"))
				removeItem(connector.id)
			} catch {
				magicToast.error(t("connectors.deleteFailed"))
			}
		},
		[removeItem, t],
	)
	const requestDeleteConnector = useCallback(
		(connector: IMCPItem) => {
			confirm({
				title: t("connectors.deleteConfirm.title", { name: connector.name }),
				description: t("connectors.deleteConfirm.description"),
				confirmText: t("connectors.deleteConfirm.confirm"),
				variant: "destructive",
				destructivePresentation: "soft",
				dialogSize: "sm",
				onConfirm: () => void deleteConnector(connector),
			})
		},
		[confirm, deleteConnector, t],
	)
	const toggleConnectorEnabled = async (connector: IMCPItem) => {
		if (statusLoadingIds.has(connector.id)) return
		setStatusLoadingIds((current) => new Set(current).add(connector.id))
		try {
			await FlowApi.saveMcp({ ...connector, enabled: !connector.enabled })
			if (connector.enabled && selectedIds.has(connector.id)) {
				await onStatusChange(connector)
			}
			updateItem(connector.id, (item) => ({ ...item, enabled: !connector.enabled }))
			magicToast.success(
				tAgent(connector.enabled ? "mcp.page.switch.disable" : "mcp.page.switch.enable", {
					name: connector.name,
				}),
			)
		} catch {
			magicToast.error(t("connectors.statusUpdateFailed"))
		} finally {
			setStatusLoadingIds((current) => {
				const next = new Set(current)
				next.delete(connector.id)
				return next
			})
		}
	}
	const authorizeConnector = useCallback((connector: IMCPItem) => {
		openAgentCommonModal({
			width: 880,
			footer: null,
			closable: false,
			children: <AgentAuthorizationTools id={connector.id} />,
		})
	}, [])
	const manageConnectorPermissions = useCallback((connector: IMCPItem) => {
		setPermissionsConnectorId(connector.id)
	}, [])
	const handleConnectorToggle = useCallback(
		(connector: IMCPItem) => onStatusChange(connector, embedded ? { zIndex: 1200 } : undefined),
		[embedded, onStatusChange],
	)

	useEffect(() => {
		onNestedPanelOpenChange?.(
			selectedConnector != null ||
				editingConnector != null ||
				createDialogOpen ||
				permissionsConnectorId != null ||
				authDialog != null,
		)
	}, [
		authDialog,
		createDialogOpen,
		editingConnector,
		onNestedPanelOpenChange,
		permissionsConnectorId,
		selectedConnector,
	])

	return (
		<div
			className={
				embedded
					? "flex h-[min(80vh,760px)] min-h-[520px] min-w-0 flex-col overflow-hidden"
					: "flex min-w-0 flex-col pt-5 sm:pt-6"
			}
			data-testid={embedded ? "connector-market-embedded" : "connector-market"}
		>
			{dialog}
			{authDialog ? (
				<ConnectorAuthDialog
					open
					{...authDialog}
					onSuccess={handleAuthDialogSuccess}
					onAuthRevoked={handleAuthDialogRevoked}
					onOpenChange={handleAuthDialogOpenChange}
				/>
			) : null}
			<ConnectorDetailDialog
				open={selectedConnector != null}
				onOpenChange={(open) => {
					if (!open) setSelectedConnector(null)
				}}
				connector={selectedConnector}
				selected={selectedConnector ? selectedIds.has(selectedConnector.id) : false}
				loading={selectedConnector ? loadingIds.has(selectedConnector.id) : false}
				onToggle={onStatusChange}
			/>
			<AuthManagerModal
				open={permissionsConnectorId != null}
				extraConfig={{
					resourceType: ResourceTypes.Mcp,
					resourceId: permissionsConnectorId ?? "",
				}}
				onClose={() => setPermissionsConnectorId(null)}
			/>
			<ConnectorCreateDialog
				open={createDialogOpen}
				connector={editingConnector}
				zIndex={embedded ? 1200 : undefined}
				onOpenChange={(open) => {
					setCreateDialogOpen(open)
					if (!open) setEditingConnector(null)
				}}
				onSuccess={() => {
					setCreateDialogOpen(false)
					setEditingConnector(null)
					magicToast.success(
						t(editingConnector ? "connectors.editSuccess" : "connectors.createSuccess"),
					)
					if (editingConnector) void retry()
					else if (group === CONNECTOR_MARKET_GROUPS.mine) void retry()
					else setGroup(CONNECTOR_MARKET_GROUPS.mine)
				}}
			/>
			{embedded ? (
				<header className="flex shrink-0 items-center justify-between gap-3 border-b border-border px-5 py-3">
					<div className="min-w-0 flex-1">
						<ConnectorCategoryFilter value={group} onChange={setGroup} />
					</div>
					<div className="flex min-w-0 flex-1 items-center justify-end gap-2">
						<Input
							value={searchQuery}
							onChange={(event) => setSearchQuery(event.target.value)}
							placeholder={t("connectors.searchPlaceholder")}
							className="h-9 min-w-0 max-w-[240px] flex-1"
							data-testid="connector-market-embedded-search-input"
						/>
						<Button
							className="h-9 gap-2 shadow-xs"
							type="button"
							data-testid="connector-market-embedded-create-button"
							onClick={() => setCreateDialogOpen(true)}
						>
							<Plus className="size-4" />
							{t("connectors.createMcp")}
						</Button>
						<Button
							variant="ghost"
							size="icon"
							className="size-7 rounded-md text-muted-foreground"
							aria-label={t("connectors.close")}
							onClick={onClose}
							data-testid="connector-market-embedded-close-button"
						>
							<X className="size-4" aria-hidden="true" />
						</Button>
					</div>
				</header>
			) : (
				<header className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
					<div className="flex min-w-0 flex-1 flex-col gap-2.5">
						<SkillMarketTabs
							value={SKILL_MARKET_TAB_VALUES.connectors}
							onValueChange={(value) => {
								if (value === SKILL_MARKET_TAB_VALUES.crew)
									navigate({ name: RouteName.CrewMarketCrew })
								if (value === SKILL_MARKET_TAB_VALUES.skills)
									navigate({ name: RouteName.CrewMarketSkills })
							}}
						/>
						<p className="max-w-2xl break-words text-sm text-muted-foreground">
							{t("connectors.subtitle")}
						</p>
					</div>

					<div className="flex w-full flex-wrap items-center gap-3 md:w-auto md:justify-end">
						<Button
							className="h-9 flex-1 gap-2 shadow-xs sm:flex-none"
							type="button"
							data-testid="connector-market-create-button"
							onClick={() => setCreateDialogOpen(true)}
						>
							<Plus className="size-4" />
							{t("connectors.create")}
						</Button>
					</div>
				</header>
			)}

			{!embedded ? (
				<MarketStickyHeader
					className="gap-5 pb-5 pt-5 sm:gap-6 sm:pb-6 sm:pt-6"
					scrollViewportRef={scrollViewportRef}
					data-testid="connector-market-sticky-header"
				>
					<SearchBar
						value={searchQuery}
						onChange={setSearchQuery}
						onSearch={(query) => setSearchQuery(query)}
						placeholder={t("connectors.searchPlaceholder")}
						enableSearchSubmit
						data-testid="connector-market-search-bar"
					/>
					<ConnectorCategoryFilter value={group} onChange={setGroup} />
				</MarketStickyHeader>
			) : null}

			<ListContainer
				{...(embedded
					? {
							className: "min-h-0 min-w-0 flex-1",
							viewportRef: viewportRef as RefObject<HTMLDivElement>,
							// Keep pagination rooted in the viewport and prevent Radix's table wrapper from widening the grid.
							viewportClassName: "min-w-0 px-5 py-4 [&>div]:!block",
						}
					: {})}
			>
				<section
					className={
						embedded ? "min-w-0" : "flex min-w-0 flex-col gap-5 pb-5 sm:gap-6 sm:pb-6"
					}
					data-testid="connector-market-list"
				>
					{error ? (
						<div className="flex flex-col items-center justify-center gap-3 py-16 text-sm text-muted-foreground">
							<span>{t("connectors.loadFailed")}</span>
							<Button variant="outline" size="sm" onClick={retry}>
								{t("connectors.retry")}
							</Button>
						</div>
					) : loading && list.length === 0 ? (
						<div className="flex items-center justify-center py-16">
							<Loader2 className="size-5 animate-spin text-muted-foreground" />
						</div>
					) : list.length === 0 ? (
						<div className="flex items-center justify-center py-16 text-sm text-muted-foreground">
							{t("connectors.empty")}
						</div>
					) : (
						<div
							className="mt-4 grid grid-cols-1 items-stretch gap-3 sm:grid-cols-2 lg:grid-cols-4 [&>*]:min-h-0"
							data-testid="connector-card-grid"
						>
							{list.map((connector) => (
								<ConnectorCard
									key={connector.id}
									connector={connector}
									selected={selectedIds.has(connector.id)}
									loading={loadingIds.has(connector.id)}
									onToggle={handleConnectorToggle}
									onOpenDetail={openDetail}
									showManageMenu={group === CONNECTOR_MARKET_GROUPS.mine}
									descriptionMaxLines={3}
									onEdit={editConnector}
									onAuthorize={authorizeConnector}
									onManagePermissions={manageConnectorPermissions}
									onDelete={requestDeleteConnector}
									onToggleEnabled={(item) => void toggleConnectorEnabled(item)}
								/>
							))}
						</div>
					)}
					{list.length > 0 ? (
						<div
							ref={sentinelRef}
							className="h-1 w-full"
							data-testid="connector-market-scroll-sentinel"
						/>
					) : null}
					{list.length > 0 ? (
						<div className="flex items-center justify-center py-2">
							{loadingMoreError ? (
								<div className="flex items-center justify-center gap-2 text-xs text-destructive">
									<span>{t("connectors.loadFailed")}</span>
									<Button
										variant="ghost"
										size="sm"
										className="h-7 px-2"
										onClick={handleAutoLoadMore}
									>
										{t("connectors.retry")}
									</Button>
								</div>
							) : hasMore ? (
								<Button
									variant="ghost"
									size="sm"
									onClick={handleAutoLoadMore}
									disabled={loadingMore}
									data-testid="connector-market-load-more"
								>
									{loadingMore ? (
										<Loader2 className="mr-2 size-4 animate-spin" />
									) : null}
									{loadingMore ? t("loadingMore") : t("loadMore")}
								</Button>
							) : (
								<div
									className="flex items-center justify-center gap-1 opacity-30"
									data-testid="connector-market-no-more"
								>
									<Check className="size-4" />
									<span className="text-xs">{t("noMoreData")}</span>
								</div>
							)}
						</div>
					) : null}
				</section>
			</ListContainer>
		</div>
	)
}
