/**
 * DevConsolePanel
 *
 * Floating panel that displays console logs and network requests
 * captured from the iframe. Renders in the main app DOM.
 */

import {
	useRef,
	useState,
	useCallback,
	useEffect,
	useMemo,
	type PointerEvent as ReactPointerEvent,
	type DragEvent as ReactDragEvent,
} from "react"

import { useTranslation } from "react-i18next"
import { cn } from "@/lib/utils"
import { platformKey } from "@/utils/storage"
import { Button } from "@/components/shadcn-ui/button"
import { Badge } from "@/components/shadcn-ui/badge"
import { Tabs, TabsList, TabsTrigger } from "@/components/shadcn-ui/tabs"
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "@/components/shadcn-ui/tooltip"
import {
	Terminal,
	Globe,
	RefreshCw,
	Trash2,
	ChevronDown,
	ChevronUp,
	X,
	Zap,
	MessageSquare,
	HardDrive,
	Code,
	CircleHelp,
	ToggleLeft,
	ToggleRight,
	Link,
	Crosshair,
} from "lucide-react"
import type {
	ConsoleEntry,
	NetworkEntry,
	ApiCallEntry,
	MessageEntry,
	StorageSnapshot,
	DependencyEntry,
	DevConsoleTab,
	DevConsoleMode,
} from "./types"
import { ConsoleTab } from "./ConsoleTab"
import { NetworkTab } from "./NetworkTab"
import { ApiTab } from "./ApiTab"
import { MessagesTab } from "./MessagesTab"
import { StorageTab } from "./StorageTab"
import { SourcesTab } from "./SourcesTab"
import { DependenciesTab } from "./DependenciesTab"
import { OnboardingDialog } from "./OnboardingDialog"

// ─── Props ───────────────────────────────────────────────────────────────────

interface DevConsolePanelProps {
	consoleEntries: ConsoleEntry[]
	networkEntries: NetworkEntry[]
	apiCallEntries: ApiCallEntry[]
	messageEntries: MessageEntry[]
	storageSnapshot: StorageSnapshot | null
	storageLoading: boolean
	sourceCode: string
	rawSourceCode?: string
	processedSourceCode?: string
	dependencyEntries: DependencyEntry[]
	activeTab: DevConsoleTab
	onTabChange: (tab: DevConsoleTab) => void
	onClearConsole: () => void
	onClearNetwork: () => void
	onClearApiCalls: () => void
	onClearMessages: () => void
	onSendErrorToAgent: (entry: ConsoleEntry | NetworkEntry) => void
	onExecuteCode: (code: string) => void
	onRequestCompletions: (expression: string) => Promise<string[]>
	onRequestStorageSnapshot: () => void
	onRefreshHtml: () => void
	consoleErrorCount: number
	networkErrorCount: number
	apiCallErrorCount: number
	onClose: () => void
	/** Element inspector active state */
	inspectorActive?: boolean
	/** Toggle element inspector */
	onToggleInspector?: () => void
}

const MIN_HEIGHT = 120
const DEFAULT_HEIGHT = 240
const MAX_HEIGHT = 600

// ─── Tab order persistence ────────────────────────────────────────────────────

const ALL_TABS: DevConsoleTab[] = [
	"console",
	"network",
	"api",
	"messages",
	"storage",
	"sources",
	"dependencies",
]
const TAB_ORDER_LS_KEY = platformKey("devConsole_tab_order")
const TAB_LABELS: Record<DevConsoleTab, string> = {
	console: "Console",
	network: "Network",
	api: "API",
	messages: "Messages",
	storage: "Storage",
	sources: "Sources",
	dependencies: "Deps",
}
/** Tabs only visible in advanced mode */
const ADVANCED_ONLY = new Set<DevConsoleTab>([
	"network",
	"api",
	"messages",
	"storage",
	"sources",
	"dependencies",
])

export function DevConsolePanel({
	consoleEntries,
	networkEntries,
	apiCallEntries,
	messageEntries,
	storageSnapshot,
	storageLoading,
	sourceCode,
	rawSourceCode,
	processedSourceCode,
	dependencyEntries,
	activeTab,
	onTabChange,
	onClearConsole,
	onClearNetwork,
	onClearApiCalls,
	onClearMessages,
	onSendErrorToAgent,
	onExecuteCode,
	onRequestCompletions,
	onRequestStorageSnapshot,
	onRefreshHtml,
	consoleErrorCount,
	networkErrorCount,
	apiCallErrorCount,
	onClose,
	inspectorActive,
	onToggleInspector,
}: DevConsolePanelProps) {
	const { t } = useTranslation("super")
	const [collapsed, setCollapsed] = useState(false)
	const [height, setHeight] = useState(DEFAULT_HEIGHT)
	const [showOnboarding, setShowOnboarding] = useState(false)
	const [mode, setMode] = useState<DevConsoleMode>(() => {
		return (localStorage.getItem(platformKey("devConsole_mode")) as DevConsoleMode) || "basic"
	})

	const toggleMode = useCallback(() => {
		setMode((prev) => {
			const next = prev === "basic" ? "advanced" : "basic"
			localStorage.setItem(platformKey("devConsole_mode"), next)
			return next
		})
	}, [])

	const isBasicMode = mode === "basic"

	// ─── Tab order (drag-to-reorder, persisted in localStorage) ─────────────

	const [tabOrder, setTabOrder] = useState<DevConsoleTab[]>(() => {
		try {
			const saved = localStorage.getItem(TAB_ORDER_LS_KEY)
			if (saved) {
				const parsed: DevConsoleTab[] = JSON.parse(saved)
				const known = new Set(ALL_TABS)
				const ordered = parsed.filter((t) => known.has(t))
				const missing = ALL_TABS.filter((t) => !ordered.includes(t))
				return [...ordered, ...missing]
			}
		} catch {
			// ignore malformed data
		}
		return [...ALL_TABS]
	})

	const dragSrcIdx = useRef(-1)
	const [dragOverIdx, setDragOverIdx] = useState(-1)

	const handleTabDragStart = useCallback(
		(e: ReactDragEvent<HTMLButtonElement>, index: number) => {
			dragSrcIdx.current = index
			e.dataTransfer.effectAllowed = "move"
		},
		[],
	)

	const handleTabDragOver = useCallback(
		(e: ReactDragEvent<HTMLButtonElement>, index: number) => {
			e.preventDefault()
			e.dataTransfer.dropEffect = "move"
			if (dragOverIdx !== index) setDragOverIdx(index)
		},
		[dragOverIdx],
	)

	const handleTabDrop = useCallback((e: ReactDragEvent<HTMLButtonElement>, index: number) => {
		e.preventDefault()
		const from = dragSrcIdx.current
		setDragOverIdx(-1)
		dragSrcIdx.current = -1
		if (from === -1 || from === index) return
		setTabOrder((prev) => {
			const next = [...prev]
			const [moved] = next.splice(from, 1)
			next.splice(index, 0, moved)
			localStorage.setItem(TAB_ORDER_LS_KEY, JSON.stringify(next))
			return next
		})
	}, [])

	const handleTabDragEnd = useCallback(() => {
		setDragOverIdx(-1)
		dragSrcIdx.current = -1
	}, [])

	/** Tabs visible in the current mode, in user-defined order */
	const visibleTabs = useMemo(
		() => (isBasicMode ? tabOrder.filter((t) => !ADVANCED_ONLY.has(t)) : tabOrder),
		[isBasicMode, tabOrder],
	)

	// In basic mode, force tab to "console" if current tab is not available
	useEffect(() => {
		if (isBasicMode && activeTab !== "console" && activeTab !== "network") {
			onTabChange("console")
		}
	}, [isBasicMode, activeTab, onTabChange])

	useEffect(() => {
		const key = platformKey("devConsole_onboarding_dismissed")
		if (!localStorage.getItem(key)) {
			setShowOnboarding(true)
		}
	}, [])

	const dismissOnboarding = useCallback(() => {
		setShowOnboarding(false)
		localStorage.setItem(platformKey("devConsole_onboarding_dismissed"), "1")
	}, [])
	const panelRef = useRef<HTMLDivElement>(null)
	const dragHandleRef = useRef<HTMLDivElement>(null)
	// Store drag state in refs — no state updates during drag
	const dragStartY = useRef(0)
	const dragStartHeight = useRef(0)

	// Pointer-capture based drag: avoids global event listeners and
	// uses direct DOM mutation so React never re-renders during drag.
	const handleDragStart = useCallback(
		(e: ReactPointerEvent<HTMLDivElement>) => {
			e.preventDefault()
			const handle = dragHandleRef.current
			if (!handle) return

			handle.setPointerCapture(e.pointerId)
			dragStartY.current = e.clientY
			dragStartHeight.current = panelRef.current?.offsetHeight ?? height

			const onMove = (ev: PointerEvent) => {
				const delta = dragStartY.current - ev.clientY
				const newHeight = Math.min(
					MAX_HEIGHT,
					Math.max(MIN_HEIGHT, dragStartHeight.current + delta),
				)
				if (panelRef.current) {
					panelRef.current.style.height = `${newHeight}px`
				}
			}

			const onUp = () => {
				handle.removeEventListener("pointermove", onMove)
				handle.removeEventListener("pointerup", onUp)
				// Sync into React state once drag ends
				if (panelRef.current) {
					setHeight(panelRef.current.offsetHeight)
				}
			}

			handle.addEventListener("pointermove", onMove)
			handle.addEventListener("pointerup", onUp)
		},
		[height],
	)

	return (
		<div
			ref={panelRef}
			className="relative flex w-full min-w-0 flex-shrink-0 flex-col overflow-hidden border-t bg-background/95 backdrop-blur-sm"
			style={{ height: collapsed ? 36 : height }}
		>
			{/* Resize handle — uses pointer capture for smooth, iframe-safe drag */}
			{!collapsed && (
				<div
					ref={dragHandleRef}
					className="absolute inset-x-0 -top-1 z-10 h-2 cursor-row-resize touch-none"
					onPointerDown={handleDragStart}
				/>
			)}

			{/* Header bar */}
			<div className="flex h-9 min-w-0 flex-shrink-0 items-center justify-between border-b px-2">
				<div className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto scrollbar-none">
					<Tabs
						value={activeTab}
						onValueChange={(v) => onTabChange(v as DevConsoleTab)}
						className="min-w-0"
					>
						<TabsList className="h-7 flex-nowrap whitespace-nowrap bg-transparent p-0">
							{visibleTabs.map((tabId, index) => {
								const isDropTarget =
									dragOverIdx === index &&
									dragSrcIdx.current !== -1 &&
									dragSrcIdx.current !== index
								return (
									<TabsTrigger
										key={tabId}
										value={tabId}
										draggable
										onDragStart={(e) => handleTabDragStart(e, index)}
										onDragOver={(e) => handleTabDragOver(e, index)}
										onDrop={(e) => handleTabDrop(e, index)}
										onDragEnd={handleTabDragEnd}
										className={cn(
											"h-6 gap-1 px-2 text-xs data-[state=active]:bg-accent",
											isDropTarget && "border-l-2 border-primary",
										)}
									>
										{tabId === "console" && <Terminal size={12} />}
										{tabId === "network" && <Globe size={12} />}
										{tabId === "api" && <Zap size={12} />}
										{tabId === "messages" && <MessageSquare size={12} />}
										{tabId === "storage" && <HardDrive size={12} />}
										{tabId === "sources" && <Code size={12} />}
										{tabId === "dependencies" && <Link size={12} />}
										{TAB_LABELS[tabId]}
										{tabId === "console" && consoleErrorCount > 0 && (
											<Badge
												variant="destructive"
												className="h-4 px-1 text-[10px]"
											>
												{consoleErrorCount}
											</Badge>
										)}
										{tabId === "network" && networkErrorCount > 0 && (
											<Badge
												variant="destructive"
												className="h-4 px-1 text-[10px]"
											>
												{networkErrorCount}
											</Badge>
										)}
										{tabId === "api" && apiCallErrorCount > 0 && (
											<Badge
												variant="destructive"
												className="h-4 px-1 text-[10px]"
											>
												{apiCallErrorCount}
											</Badge>
										)}
										{tabId === "messages" && messageEntries.length > 0 && (
											<Badge
												variant="secondary"
												className="h-4 px-1 text-[10px]"
											>
												{messageEntries.length}
											</Badge>
										)}
										{tabId === "dependencies" &&
											dependencyEntries.length > 0 && (
												<Badge
													variant="secondary"
													className="h-4 px-1 text-[10px]"
												>
													{dependencyEntries.length}
												</Badge>
											)}
									</TabsTrigger>
								)
							})}
						</TabsList>
					</Tabs>
				</div>

				<div className="flex items-center gap-1">
					{/* Clear button — only for tabs with clearable entries, advanced mode only */}
					{!isBasicMode &&
						(activeTab === "console" ||
							activeTab === "network" ||
							activeTab === "api" ||
							activeTab === "messages") && (
							<TooltipProvider delayDuration={200}>
								<Tooltip>
									<TooltipTrigger asChild>
										<Button
											variant="ghost"
											size="icon"
											className="h-6 w-6"
											onClick={
												activeTab === "console"
													? onClearConsole
													: activeTab === "network"
														? onClearNetwork
														: activeTab === "api"
															? onClearApiCalls
															: onClearMessages
											}
										>
											<Trash2 size={12} />
										</Button>
									</TooltipTrigger>
									<TooltipContent className="text-xs">
										{t("stylePanel.devConsole.clear")}
									</TooltipContent>
								</Tooltip>
							</TooltipProvider>
						)}

					{/* Element Inspector button */}
					{onToggleInspector && (
						<TooltipProvider delayDuration={200}>
							<Tooltip>
								<TooltipTrigger asChild>
									<Button
										variant="ghost"
										size="icon"
										className={cn(
											"h-6 w-6",
											inspectorActive && "bg-blue-500/15 text-blue-500",
										)}
										onClick={onToggleInspector}
										data-testid="dev-console-inspector-button"
									>
										<Crosshair size={12} />
									</Button>
								</TooltipTrigger>
								<TooltipContent className="text-xs">
									{inspectorActive
										? t("stylePanel.inspector.stop")
										: t("stylePanel.inspector.start")}
								</TooltipContent>
							</Tooltip>
						</TooltipProvider>
					)}

					{/* Refresh HTML button */}
					<TooltipProvider delayDuration={200}>
						<Tooltip>
							<TooltipTrigger asChild>
								<Button
									variant="ghost"
									size="icon"
									className="h-6 w-6"
									onClick={onRefreshHtml}
									data-testid="dev-console-refresh-html-button"
								>
									<RefreshCw size={12} />
								</Button>
							</TooltipTrigger>
							<TooltipContent className="text-xs">
								{t("stylePanel.devConsole.refreshHtml")}
							</TooltipContent>
						</Tooltip>
					</TooltipProvider>

					{/* Mode toggle */}
					<TooltipProvider delayDuration={200}>
						<Tooltip>
							<TooltipTrigger asChild>
								<Button
									variant="ghost"
									size="icon"
									className="h-6 w-6"
									onClick={toggleMode}
								>
									{isBasicMode ? (
										<ToggleLeft size={14} />
									) : (
										<ToggleRight size={14} className="text-primary" />
									)}
								</Button>
							</TooltipTrigger>
							<TooltipContent className="text-xs">
								{isBasicMode
									? t("stylePanel.devConsole.switchToAdvanced")
									: t("stylePanel.devConsole.switchToBasic")}
							</TooltipContent>
						</Tooltip>
					</TooltipProvider>

					<TooltipProvider delayDuration={200}>
						<Tooltip>
							<TooltipTrigger asChild>
								<Button
									variant="ghost"
									size="icon"
									className="h-6 w-6"
									onClick={() => setShowOnboarding(true)}
								>
									<CircleHelp size={12} />
								</Button>
							</TooltipTrigger>
							<TooltipContent className="text-xs">
								{t("stylePanel.devConsole.onboarding.title")}
							</TooltipContent>
						</Tooltip>
					</TooltipProvider>

					<Button
						variant="ghost"
						size="icon"
						className="h-6 w-6"
						onClick={() => setCollapsed(!collapsed)}
					>
						{collapsed ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
					</Button>

					<Button variant="ghost" size="icon" className="h-6 w-6" onClick={onClose}>
						<X size={14} />
					</Button>
				</div>
			</div>

			<OnboardingDialog open={showOnboarding} onClose={dismissOnboarding} mode={mode} />

			{/* Content */}
			{!collapsed && (
				<div className="min-h-0 flex-1 overflow-hidden">
					{activeTab === "console" ? (
						<ConsoleTab
							entries={consoleEntries}
							onSendErrorToAgent={onSendErrorToAgent}
							onExecuteCode={onExecuteCode}
							onRequestCompletions={onRequestCompletions}
							mode={mode}
						/>
					) : activeTab === "network" ? (
						<NetworkTab
							entries={networkEntries}
							onSendErrorToAgent={onSendErrorToAgent}
						/>
					) : activeTab === "api" ? (
						<ApiTab entries={apiCallEntries} />
					) : activeTab === "messages" ? (
						<MessagesTab entries={messageEntries} />
					) : activeTab === "storage" ? (
						<StorageTab
							data={storageSnapshot}
							onRefresh={onRequestStorageSnapshot}
							loading={storageLoading}
						/>
					) : activeTab === "sources" ? (
						<SourcesTab
							sourceCode={sourceCode}
							rawSourceCode={rawSourceCode}
							processedSourceCode={processedSourceCode}
						/>
					) : (
						<DependenciesTab entries={dependencyEntries} />
					)}
				</div>
			)}
		</div>
	)
}
