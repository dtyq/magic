import { useRef, useState, type RefObject } from "react"
import type { IMCPItem } from "@/components/Agent/MCP/types"
import { FlowApi } from "@/apis"
import { InfiniteScroll } from "antd-mobile"
import { useTranslation } from "react-i18next"
import { ChevronLeft, Plus, Search } from "lucide-react"
import { Button } from "@/components/shadcn-ui/button"
import { useConfirmDialog } from "@/components/shadcn-composed/confirm-dialog"
import { openAgentCommonModal } from "@/components/Agent/AgentCommonModal"
import AgentAuthorizationTools from "@/components/Agent/AgentTools/AgentAuthorizationTools/AgentAuthorizationTools"
import AuthManagerModal from "@/pages/flow/components/AuthControlButton/AuthManagerModal"
import { ResourceTypes } from "@/pages/flow/components/AuthControlButton/types"
import { Input } from "@/components/shadcn-ui/input"
import { ScrollArea } from "@/components/shadcn-ui/scroll-area"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/shadcn-ui/sheet"
import useNavigate from "@/routes/hooks/useNavigate"
import { RouteName } from "@/routes/constants"
import SkillMarketTabs, {
	SKILL_MARKET_TAB_VALUES,
} from "@/pages/superMagic/pages/SkillMarket/components/SkillMarketTabs"
import { useConnectorMarket } from "../hooks/useConnectorMarket"
import ConnectorCardMobile from "./ConnectorCardMobile"
import ConnectorCategoryFilter, {
	CONNECTOR_MARKET_GROUPS,
	type ConnectorMarketGroup,
} from "./ConnectorCategoryFilter"
import { useConnectorActions } from "../hooks/useConnectorActions"
import ConnectorDetailDialog from "./ConnectorDetailDialog"
import { ConnectorAuthDialog } from "@/components/Agent/MCP/AgentSettings/AgentPanel/MCPPanel/helpers"
import ConnectorCreateDialog from "./ConnectorCreateDialog"
import magicToast from "@/components/base/MagicToaster/utils"

interface ConnectorLibraryMobileProps {
	scrollViewportRef?: RefObject<HTMLDivElement | null>
}

export default function ConnectorLibraryMobile({ scrollViewportRef }: ConnectorLibraryMobileProps) {
	const { t } = useTranslation("crew/market")
	const { t: tAgent } = useTranslation("agent")
	const navigate = useNavigate()
	const [searchOpen, setSearchOpen] = useState(false)
	const [searchQuery, setSearchQuery] = useState("")
	const [queryDraft, setQueryDraft] = useState("")
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
		handleAuthDialogOpenChange,
		onStatusChange,
	} = useConnectorActions()
	const {
		list,
		loading,
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
	const [statusLoadingIds, setStatusLoadingIds] = useState<Set<string>>(new Set())

	const openDetail = (connector: IMCPItem) => setSelectedConnector(connector)
	const editConnector = (connector: IMCPItem) => {
		setSelectedConnector(null)
		setEditingConnector(connector)
		setCreateDialogOpen(true)
	}
	const deleteConnector = async (connector: IMCPItem) => {
		try {
			await FlowApi.deleteMcp(connector.id)
			magicToast.success(t("connectors.deleteSuccess"))
			removeItem(connector.id)
		} catch {
			magicToast.error(t("connectors.deleteFailed"))
		}
	}
	const requestDeleteConnector = (connector: IMCPItem) => {
		confirm({
			title: t("connectors.deleteConfirm.title", { name: connector.name }),
			description: t("connectors.deleteConfirm.description"),
			confirmText: t("connectors.deleteConfirm.confirm"),
			variant: "destructive",
			destructivePresentation: "soft",
			dialogSize: "sm",
			onConfirm: () => void deleteConnector(connector),
		})
	}
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
	const authorizeConnector = (connector: IMCPItem) => {
		openAgentCommonModal({
			width: 880,
			footer: null,
			closable: false,
			children: <AgentAuthorizationTools id={connector.id} />,
		})
	}
	const manageConnectorPermissions = (connector: IMCPItem) => {
		setPermissionsConnectorId(connector.id)
	}

	function handleSearchOpenChange(open: boolean) {
		setSearchOpen(open)
		if (open) setQueryDraft(searchQuery)
	}

	function handleApplySearch() {
		setSearchQuery(queryDraft.trim())
		setSearchOpen(false)
	}

	return (
		<div
			className="flex h-full min-h-0 w-full min-w-0 flex-col overflow-hidden border border-t-0 border-border bg-background shadow-xs"
			data-testid="connector-market-mobile-page"
		>
			{dialog}
			{authDialog ? (
				<ConnectorAuthDialog
					open
					{...authDialog}
					onSuccess={handleAuthDialogSuccess}
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
				className="!max-h-[calc(100%-1rem)] !w-[calc(100%-1rem)] !max-w-[760px]"
			/>
			<header
				className="flex shrink-0 items-center gap-2 rounded-b-xl bg-background px-2.5 py-2 shadow-xs"
				data-testid="connector-market-mobile-top-bar"
			>
				<Button
					variant="ghost"
					size="icon"
					className="size-8 shrink-0 rounded-lg"
					onClick={() => navigate({ delta: -1 })}
					aria-label={t("back")}
					data-testid="connector-market-mobile-back"
				>
					<ChevronLeft className="size-6" aria-hidden />
				</Button>
				<SkillMarketTabs
					value={SKILL_MARKET_TAB_VALUES.connectors}
					onValueChange={(value) => {
						if (value === SKILL_MARKET_TAB_VALUES.crew)
							navigate({ name: RouteName.CrewMarketCrew })
						if (value === SKILL_MARKET_TAB_VALUES.skills)
							navigate({ name: RouteName.CrewMarketSkills })
					}}
					className="min-w-0 flex-1"
					compact
				/>
				<div className="flex shrink-0 items-center gap-1">
					<Button
						variant="ghost"
						size="icon"
						className="size-8 rounded-md"
						onClick={() => handleSearchOpenChange(true)}
						aria-label={t("connectors.searchAria")}
						data-testid="connector-market-mobile-search-open"
					>
						<Search className="size-4" aria-hidden />
					</Button>
					<Button
						variant="ghost"
						className="h-8 shrink-0 gap-1 rounded-md px-2 text-xs font-medium text-foreground"
						type="button"
						data-testid="connector-market-mobile-create-button"
						onClick={() => setCreateDialogOpen(true)}
					>
						<Plus className="size-4" aria-hidden />
						{t("connectors.create")}
					</Button>
				</div>
			</header>

			<div
				className="shrink-0 border-b border-border bg-background px-3"
				data-testid="connector-market-mobile-filter"
			>
				<ConnectorCategoryFilter value={group} onChange={setGroup} />
			</div>

			<Sheet open={searchOpen} onOpenChange={handleSearchOpenChange}>
				<SheetContent side="bottom" className="rounded-t-xl px-4 pb-6">
					<SheetHeader className="text-left">
						<SheetTitle>{t("connectors.searchSheetTitle")}</SheetTitle>
					</SheetHeader>
					<div className="flex flex-col gap-3">
						<Input
							value={queryDraft}
							onChange={(event) => setQueryDraft(event.target.value)}
							placeholder={t("connectors.searchPlaceholder")}
							onKeyDown={(event) => {
								if (event.key !== "Enter") return
								handleApplySearch()
							}}
							data-testid="connector-market-mobile-search-input"
						/>
						<Button
							className="w-full gap-2 shadow-xs"
							onClick={handleApplySearch}
							data-testid="connector-market-mobile-search-submit"
						>
							<Search className="size-4" />
							{t("mobile.runSearch")}
						</Button>
					</div>
				</SheetContent>
			</Sheet>

			<ScrollArea
				className="min-h-0 flex-1 [&_[data-slot='scroll-area-scrollbar']]:hidden [&_[data-slot='scroll-area-viewport']>div]:!block"
				viewportRef={viewportRef as RefObject<HTMLDivElement>}
			>
				<div className="flex min-w-0 flex-col gap-4 px-2 pb-6 pt-3">
					{error ? (
						<div className="flex flex-col items-center justify-center gap-3 py-16 text-sm text-muted-foreground">
							<span>{t("connectors.loadFailed")}</span>
							<Button variant="outline" size="sm" onClick={retry}>
								{t("connectors.retry")}
							</Button>
						</div>
					) : loading && list.length === 0 ? (
						<div className="flex items-center justify-center py-16">
							<div className="size-6 animate-spin rounded-full border-2 border-muted-foreground/30 border-t-muted-foreground" />
						</div>
					) : list.length === 0 ? (
						<div className="flex items-center justify-center py-16 text-sm text-muted-foreground">
							{t("connectors.empty")}
						</div>
					) : (
						<div
							className="flex flex-col gap-2.5"
							data-testid="connector-mobile-card-list"
						>
							{list.map((connector) => (
								<ConnectorCardMobile
									key={connector.id}
									connector={connector}
									selected={selectedIds.has(connector.id)}
									loading={loadingIds.has(connector.id)}
									onToggle={onStatusChange}
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
					{loadingMoreError ? (
						<div className="flex items-center justify-center gap-2 py-2 text-xs text-destructive">
							<span>{t("connectors.loadFailed")}</span>
							<Button
								variant="ghost"
								size="sm"
								className="h-7 px-2"
								onClick={loadMore}
							>
								{t("connectors.retry")}
							</Button>
						</div>
					) : null}
					{list.length > 0 ? (
						<InfiniteScroll hasMore={hasMore} loadMore={() => loadMore()} />
					) : null}
				</div>
			</ScrollArea>
		</div>
	)
}
