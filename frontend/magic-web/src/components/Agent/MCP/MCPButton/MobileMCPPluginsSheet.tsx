import { useMemo, useState, type KeyboardEvent } from "react"
import { observer } from "mobx-react-lite"
import { Check, Plug, Plus, Search, Settings, X } from "lucide-react"
import { IconLoader2 } from "@tabler/icons-react"
import MagicPopup from "@/components/base-mobile/MagicPopup"
import MagicImage from "@/components/base/MagicImage"
import { cn } from "@/lib/utils"
import { useTranslation } from "react-i18next"
import {
	useMCPPanelController,
	MCPUserGroup,
} from "../AgentSettings/AgentPanel/MCPPanel/useMCPPanelController"
import type { MCPButtonProps } from "./MCPButton"
import type { IMCPItem } from "../types"
import { hasEditRight } from "@/pages/flow/components/AuthControlButton/types"
import { IconMCP } from "@/enhance/tabler/icons-react"

interface MobileMCPPluginsSheetProps {
	open: boolean
	onClose: () => void
	storageKey?: MCPButtonProps["storageKey"]
	useTempStorage?: boolean
}

function MobileMCPPluginItem({
	item,
	selected,
	onToggle,
	onSettings,
}: {
	item: IMCPItem
	selected: boolean
	onToggle: (item: IMCPItem) => Promise<void>
	onSettings: (item: IMCPItem) => void
}) {
	const { t } = useTranslation("agent")
	const isEditable = hasEditRight(item.user_operation)
	const [isLoading, setIsLoading] = useState(false)

	const handleToggle = async () => {
		setIsLoading(true)
		try {
			await onToggle(item)
		} catch (error) {
			console.error(error)
		} finally {
			setIsLoading(false)
		}
	}

	const handleKeyDown = async (event: KeyboardEvent<HTMLDivElement>) => {
		if (event.key !== "Enter" && event.key !== " ") return
		event.preventDefault()
		void handleToggle()
	}

	return (
		<div
			role="button"
			tabIndex={0}
			onClick={() => void handleToggle()}
			onKeyDown={handleKeyDown}
			className={cn(
				"flex items-center gap-0 rounded-[10px] px-4 py-2 text-left transition-all",
				selected
					? "bg-card shadow-[0px_1px_3px_0px_rgba(0,0,0,0.1),0px_1px_2px_-1px_rgba(0,0,0,0.1)]"
					: "bg-transparent",
			)}
			data-testid="mobile-mcp-plugins-sheet-item"
			data-selected={selected}
		>
			<div className="flex min-w-0 flex-1 flex-col gap-[6px]">
				<div className="flex h-5 w-full items-center gap-2">
					<div className="relative size-5 shrink-0 overflow-hidden rounded-[4px]">
						<MagicImage
							className="size-full rounded-[4px]"
							src={item.icon}
							alt={item.name}
							fallback={
								<div className="flex size-5 items-center justify-center overflow-hidden rounded-[4px] bg-info/10">
									<Plug className="size-3 text-info" strokeWidth={2.5} />
								</div>
							}
						/>
					</div>
					<span className="flex-1 truncate text-[16px] font-medium leading-5 text-foreground">
						{item.name}
					</span>
					{isEditable ? (
						<button
							type="button"
							onClick={(event) => {
								event.preventDefault()
								event.stopPropagation()
								onSettings(item)
							}}
							className="inline-flex size-6 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-muted/80 active:bg-muted"
							aria-label={t("mcp.panel.settings")}
							data-testid="mobile-mcp-plugins-sheet-settings-button"
						>
							<Settings className="size-4" />
						</button>
					) : null}
					{isLoading ? (
						<IconLoader2
							className="size-4 shrink-0 animate-spin text-muted-foreground"
							data-testid="mobile-mcp-plugins-sheet-item-loading"
						/>
					) : selected ? (
						<Check
							className="size-4 shrink-0 text-foreground"
							strokeWidth={2.5}
							data-testid="mobile-mcp-plugins-sheet-item-selected-icon"
						/>
					) : null}
				</div>
				<p className="line-clamp-2 w-full text-left text-[14px] font-normal leading-5 text-muted-foreground">
					{item.description || t("mcp.card.desc")}
				</p>
			</div>
		</div>
	)
}

function MobileMCPPluginsSheet({
	open,
	onClose,
	storageKey,
	useTempStorage = false,
}: MobileMCPPluginsSheetProps) {
	const { t } = useTranslation("agent")
	const controller = useMCPPanelController({
		storageKey,
		useTempStorage,
	})

	const {
		type,
		setType,
		searchText,
		setSearchText,
		data,
		loading,
		openCreateForm,
		openEditForm,
		onStatusChange,
		usableCache,
		selectedCount,
	} = controller

	const options = useMemo(
		() => [
			{
				value: MCPUserGroup.Official,
				label: t("mcp.panel.official"),
			},
			{
				value: MCPUserGroup.Organization,
				label: t("mcp.panel.custom"),
			},
		],
		[t],
	)

	return (
		<MagicPopup
			visible={open}
			onClose={onClose}
			className="rounded-t-[14px] border-0 bg-muted shadow-[0_-4px_24px_rgba(0,0,0,0.08)]"
			bodyClassName="rounded-t-[14px] border-0 bg-muted p-0 overflow-hidden"
			handlerClassName="bg-muted-foreground mb-1.5 h-1 w-20 rounded-full"
			title={t("mcp.button.text")}
		>
			<div
				className="flex h-[min(640px,calc(100vh-var(--safe-area-inset-top)-var(--safe-area-inset-bottom)-44px))] min-h-0 w-full flex-col overflow-hidden bg-muted"
				data-testid="mobile-mcp-plugins-sheet"
			>
				<div className="relative z-10 flex h-14 w-full shrink-0 items-center justify-center px-20 py-2">
					<button
						type="button"
						onClick={onClose}
						className="absolute left-2.5 top-1/2 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-card"
						style={{ boxShadow: "0px 8px 25px 0px rgba(0,0,0,0.10)" }}
						aria-label={t("common.auth.cancel")}
						data-testid="mobile-mcp-plugins-sheet-close-button"
					>
						<X className="h-[22px] w-[22px] text-foreground" />
					</button>

					<div className="max-w-[180px] truncate text-center text-lg font-medium leading-6 text-foreground">
						{t("mcp.button.text")}
						{selectedCount > 0 ? ` (${selectedCount})` : ""}
					</div>

					{type === MCPUserGroup.Organization ? (
						<button
							type="button"
							onClick={openCreateForm}
							className="absolute right-2.5 top-1/2 inline-flex h-10 -translate-y-1/2 items-center gap-1 rounded-full bg-card px-3 text-sm font-medium text-foreground"
							style={{ boxShadow: "0px 8px 25px 0px rgba(0,0,0,0.10)" }}
							data-testid="mobile-mcp-plugins-sheet-create-button"
						>
							<Plus className="size-4" />
							{t("mcp.panel.create")}
						</button>
					) : null}
				</div>

				<div className="flex shrink-0 flex-col gap-3 px-3.5 pb-2 pt-3">
					<div
						className="inline-flex w-fit max-w-full items-center gap-1 rounded-xl border border-border bg-card p-1"
						data-testid="mobile-mcp-plugins-sheet-group-tabs"
					>
						{options.map((option) => {
							const isActive = option.value === type
							return (
								<button
									key={option.value}
									type="button"
									onClick={() => setType(option.value)}
									className={cn(
										"rounded-lg px-3 py-1.5 text-sm leading-5 transition",
										isActive
											? "bg-background font-semibold text-foreground shadow-[0_4px_14px_0_rgba(0,0,0,0.1),0_0_1px_0_rgba(0,0,0,0.3)]"
											: "text-muted-foreground",
									)}
									data-testid={`mobile-mcp-plugins-sheet-group-${option.value}`}
								>
									{option.label}
								</button>
							)
						})}
					</div>
				</div>

				{loading ? (
					<div
						className="flex min-h-0 flex-1 items-center justify-center"
						data-testid="mobile-mcp-plugins-sheet-loading"
					>
						<IconLoader2 className="size-5 animate-spin text-muted-foreground" />
					</div>
				) : (
					<div className="flex min-h-0 w-full flex-1 flex-col gap-2 overflow-y-auto">
						{data?.map((item) => (
							<MobileMCPPluginItem
								key={item.id}
								item={item}
								selected={usableCache.has(item.id)}
								onToggle={onStatusChange}
								onSettings={openEditForm}
							/>
						))}

						{data && data.length < 1 ? (
							<div
								className="flex flex-1 flex-col items-center justify-center gap-2 text-center"
								data-testid="mobile-mcp-plugins-sheet-empty"
							>
								<IconMCP size={48} />
								<div className="text-sm text-muted-foreground">
									{t("mcp.panel.empty")}
								</div>
							</div>
						) : null}
					</div>
				)}

				<div className="shrink-0 px-2.5 pb-[max(var(--safe-area-inset-bottom),10px)] pt-2">
					<div className="flex items-center gap-2 rounded-full border border-border bg-background px-4 py-2.5 shadow-xs">
						<Search className="h-4 w-4 shrink-0 text-muted-foreground" />
						<input
							type="search"
							value={searchText}
							onChange={(event) => setSearchText(event.target.value)}
							placeholder={t("mcp.panel.searchPlaceholder")}
							className="min-h-0 flex-1 border-0 bg-transparent text-base text-foreground outline-none placeholder:text-muted-foreground"
							autoComplete="off"
							autoCorrect="off"
							autoCapitalize="off"
							spellCheck={false}
							enterKeyHint="search"
							data-testid="mobile-mcp-plugins-sheet-search-input"
						/>
						{searchText ? (
							<button
								type="button"
								onClick={() => setSearchText("")}
								className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-muted-foreground text-background transition active:opacity-80"
								aria-label={t("common.auth.cancel")}
								data-testid="mobile-mcp-plugins-sheet-search-clear-button"
							>
								<X className="h-3 w-3" />
							</button>
						) : null}
					</div>
				</div>
			</div>
		</MagicPopup>
	)
}

export default observer(MobileMCPPluginsSheet)
