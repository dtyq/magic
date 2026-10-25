import { useEffect, useState } from "react"
import { IconPlus } from "@tabler/icons-react"
import { useMemoizedFn, useCreation } from "ahooks"
import { AgentCommonModal } from "../../AgentCommonModal"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/shadcn-ui/popover"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/shadcn-ui/tooltip"
import { IconMCP } from "@/enhance/tabler/icons-react"
import MagicImage from "@/components/base/MagicImage"
import { useTranslation } from "react-i18next"
import pubsub, { PubSubEvents } from "@/utils/pubsub"
import { getMCPAccess, loadMCPWithInstalledConnectorReconciliation } from "../store/mcp-access"
import AgentSettings from "../AgentSettings"
import MobileMCPPluginsSheet from "./MobileMCPPluginsSheet"
import { cn } from "@/utils/cn"
import { Plug, Unplug } from "lucide-react"
import { useIsMobile } from "@/hooks/useIsMobile"
import { Badge } from "@/components/shadcn-ui/badge"
import { Switch } from "@/components/shadcn-ui/switch"
import { ScrollArea } from "@/components/shadcn-ui/scroll-area"
import { MessageEditorSize } from "@/pages/superMagic/components/MessageEditor/types"
import { observer } from "mobx-react-lite"
import { mcpEnabledStore } from "../store/mcp-enabled-store"
import ConnectorLibrary from "@/pages/superMagic/pages/ConnectorMarket/components/ConnectorLibrary"

// Lazy modal loading can keep the button render independent of modal initialization.
// const LazyAgentCommonModal = lazy(() =>
// 	import("../../AgentCommonModal").then((m) => ({ default: m.AgentCommonModal })),
// )
// const LazyAgentSettings = lazy(() => import("../AgentSettings"))

// Preload modal components after rendering the button without blocking it.
// const preloadModalComponents = () => {
// 	import("../../AgentCommonModal")
// 	import("../AgentSettings")
// }

// Construct a unique AgentModal pop-up instance
// class AgentModal {
// 	static instance: ReturnType<typeof openAgentCommonModal> | null = null

// 	static open(onSuccessCallback?: () => void, storageKey?: string, useTempStorage?: boolean) {
// 		if (AgentModal.instance) {
// 			AgentModal.instance?.onClose?.()
// 			AgentModal.instance = null
// 		} else {
// 			AgentModal.instance = openAgentCommonModal({
// 				width: 900,
// 				footer: null,
// 				closable: false,
// 				onClose: () => {
// 					AgentModal.instance = null
// 				},
// 				children: (
// 					<AgentSettings
// 						onSuccessCallback={onSuccessCallback}
// 						storageKey={storageKey}
// 						useTempStorage={useTempStorage}
// 					/>
// 				),
// 			})
// 		}
// 	}
// }

export interface MCPButtonProps {
	className?: string
	/** Storage value (affected by the business scope of MCP, currently it needs to be associated with the Super Maggie project when using MCP configuration in Super Maggie) */
	storageKey?: string
	size?: MessageEditorSize
	iconSize?: number
	/** Use temporary local storage without saving through the API. */
	useTempStorage?: boolean
}

/**
 * @description MCP button component
 * Current component storage strategy uses `ProjectStorage` Super Magic project association storage strategy
 * @param props
 * @constructor
 */
function MCPButton(props?: MCPButtonProps) {
	const { useTempStorage = false, iconSize = 20, size } = props || {}
	const isMobile = useIsMobile()
	const { t } = useTranslation("agent")

	const [modalOpen, setModalOpen] = useState(false)
	const [connectorMarketOpen, setConnectorMarketOpen] = useState(false)
	const [connectorMarketNestedOpen, setConnectorMarketNestedOpen] = useState(false)
	const [menuOpen, setMenuOpen] = useState(false)
	const [enabledMCPIds, setEnabledMCPIds] = useState<Set<string>>(() => new Set())
	const [switchLoadingIds, setSwitchLoadingIds] = useState<Set<string>>(() => new Set())
	const addedMCPAccess = useCreation(() => getMCPAccess({ storageKey: "__added__" }), [])
	const activeMCPAccess = useCreation(
		() =>
			getMCPAccess({
				storageKey: props?.storageKey,
				useTempStorage,
			}),
		[props?.storageKey, useTempStorage],
	)
	const activeStorageKey = props?.storageKey || "__template_project_id__"

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
	const enabledCount = displayMCPList.filter((item) => enabledMCPIds.has(item.id)).length

	const closeModal = useMemoizedFn(() => {
		setModalOpen(false)
	})

	const openSettings = useMemoizedFn(() => {
		setMenuOpen(false)
		setModalOpen(true)
	})

	const openConnectorMarket = useMemoizedFn(() => {
		setMenuOpen(false)
		setConnectorMarketOpen(true)
	})

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
				// The temporary storage persists full items, so use the complete
				// added connector list. The active list does not contain a newly
				// enabled connector yet and would filter it out before persistence.
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

	// The project setting is the source of truth for which added connectors are enabled.
	useEffect(() => {
		if (!activeMCPAccess.initialized) return
		const ids = activeMCPAccess.mcpList.map((item) => item.id)
		setEnabledMCPIds(new Set(ids))
		mcpEnabledStore.setEnabledIds(ids)
	}, [activeMCPAccess.initialized, activeMCPIds])

	const button = (
		<button
			type="button"
			className={cn(
				"flex items-center justify-center gap-1 rounded-md border-0 bg-[#f5f5f5] text-foreground transition-all hover:opacity-80 active:opacity-60",
				"dark:bg-sidebar dark:text-foreground dark:hover:bg-muted dark:hover:text-foreground",
				size === "small" ? "h-6" : "h-8",
				props?.className,
			)}
			onClick={isMobile ? () => setModalOpen(true) : undefined}
			data-testid="mcp-button"
			data-count={enabledCount}
			data-active={enabledCount > 0}
		>
			<Plug size={iconSize} />
			{enabledCount > 0 && (
				<Badge
					variant="outline"
					className="h-5 overflow-visible rounded-md bg-white px-2 py-0.5 text-xs font-semibold"
				>
					{enabledCount}
				</Badge>
			)}
		</button>
	)

	useEffect(() => {
		pubsub.subscribe(PubSubEvents.Open_MCP_Config, openSettings)
		return () => {
			pubsub.unsubscribe(PubSubEvents.Open_MCP_Config, openSettings)
		}
	}, [openSettings])

	// Declarative lazy modal alternative that does not block the button render.
	// const modal = (
	// 	<Suspense fallback={null}>
	// 		<LazyAgentCommonModal
	// 			open={modalOpen}
	// 			onOpenChange={setModalOpen}
	// 			width={900}
	// 			footer={null}
	// 			closable={false}
	// 		>
	// 			<LazyAgentSettings
	// 				onSuccessCallback={refresh}
	// 				storageKey={props?.storageKey}
	// 				useTempStorage={useTempStorage}
	// 				onClose={closeModal}
	// 			/>
	// 		</LazyAgentCommonModal>
	// 	</Suspense>
	// )
	const modal = (
		<AgentCommonModal
			open={modalOpen}
			onOpenChange={setModalOpen}
			width={900}
			footer={null}
			closable={false}
		>
			<AgentSettings
				storageKey={props?.storageKey}
				useTempStorage={useTempStorage}
				onClose={closeModal}
			/>
		</AgentCommonModal>
	)
	const connectorMarketModal = (
		<AgentCommonModal
			open={connectorMarketOpen}
			onOpenChange={setConnectorMarketOpen}
			width={1120}
			keyboard={!connectorMarketNestedOpen}
			footer={null}
			closable={false}
		>
			<ConnectorLibrary
				embedded
				activeStorageKey={props?.storageKey}
				useTempStorage={useTempStorage}
				onClose={() => setConnectorMarketOpen(false)}
				onNestedPanelOpenChange={setConnectorMarketNestedOpen}
			/>
		</AgentCommonModal>
	)

	// Mobile view
	if (isMobile) {
		return (
			<>
				{button}
				<MobileMCPPluginsSheet
					open={modalOpen}
					onClose={closeModal}
					storageKey={props?.storageKey}
					useTempStorage={useTempStorage}
				/>
			</>
		)
	}

	const content = (
		<div className="flex max-h-[320px] flex-col overflow-hidden">
			<div className="px-3 pb-1 pt-2.5 text-xs font-medium text-muted-foreground">
				{t("mcp.button.addedConnectors")}
			</div>
			<ScrollArea
				className="min-h-0"
				viewportClassName="max-h-[240px] pl-1.5 pr-3 pb-1 [&>div]:!block"
			>
				{displayMCPList.length > 0 ? (
					displayMCPList.map((item) => (
						<div
							className="flex items-center gap-2.5 rounded-md px-2 py-2 transition-colors hover:bg-accent/60"
							key={item.id}
							data-testid="mcp-installed-connector-item"
						>
							<MagicImage
								className="h-9 w-9 flex-none overflow-hidden rounded-lg"
								src={item?.icon}
								alt={item?.name}
								fallback={
									<div className="h-9 w-9 flex-none overflow-hidden rounded-lg">
										<IconMCP size="100%" />
									</div>
								}
							/>
							<div className="min-w-0 flex-1">
								<div className="line-clamp-1 text-sm font-medium leading-5 text-foreground">
									{item.name}
								</div>
								<div className="line-clamp-1 text-xs leading-4 text-muted-foreground">
									{item?.description || t("mcp.card.desc")}
								</div>
							</div>
							<Switch
								aria-label={t("mcp.button.toggleConnector", { name: item.name })}
								checked={enabledMCPIds.has(item.id)}
								loading={
									!activeMCPAccess.initialized || switchLoadingIds.has(item.id)
								}
								data-testid="mcp-installed-connector-switch"
								onCheckedChange={(checked) =>
									void toggleMCPEnabled(item.id, checked)
								}
							/>
						</div>
					))
				) : (
					<div className="flex min-h-[120px] flex-col items-center justify-center gap-2 py-6">
						<Unplug className="size-8 text-muted-foreground/50" aria-hidden="true" />
						<div className="text-sm text-muted-foreground">
							{t("mcp.button.emptyConnectors")}
						</div>
					</div>
				)}
			</ScrollArea>
			<div className="border-t border-border p-1.5">
				<button
					type="button"
					className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm font-medium text-foreground transition-colors hover:bg-accent"
					onClick={openConnectorMarket}
					data-testid="mcp-add-more-connectors-button"
				>
					<IconPlus size={16} />
					{t("mcp.button.addMoreConnectors")}
				</button>
			</div>
		</div>
	)

	return (
		<>
			<Popover open={menuOpen} onOpenChange={setMenuOpen}>
				<Tooltip>
					<TooltipTrigger asChild>
						<span className="inline-flex">
							<PopoverTrigger asChild>{button}</PopoverTrigger>
						</span>
					</TooltipTrigger>
					<TooltipContent side="top" className="z-[1200]">
						{t("mcp.button.text")}
					</TooltipContent>
				</Tooltip>
				<PopoverContent
					side="top"
					align="end"
					sideOffset={8}
					collisionPadding={16}
					className="z-[1200] max-h-[calc(100vh-32px)] w-[min(320px,calc(100vw-32px))] max-w-[calc(100vw-32px)] overflow-hidden p-0"
					data-testid="mcp-installed-connectors-panel"
				>
					{content}
				</PopoverContent>
			</Popover>
			{modal}
			{connectorMarketModal}
		</>
	)
}

export default observer(MCPButton)
