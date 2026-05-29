import {
	useCallback,
	useEffect,
	useMemo,
	useRef,
	useState,
	type MouseEvent as ReactMouseEvent,
	type RefObject,
} from "react"
import { observer } from "mobx-react-lite"
import { useTranslation, Trans } from "react-i18next"
import { isString } from "lodash-es"
import { useMemoizedFn } from "ahooks"
import { Check, ChevronsUpDown, MessageCirclePlus, Search } from "lucide-react"
import { CrewItem } from "../../pages/Workspace/types"
import { TopicMode } from "../../pages/Workspace/TopicMode"
import { useFeaturedModeListRefreshOnFirstOpen } from "@/pages/superMagic/hooks/useFeaturedModeListRefresh"
import superMagicModeService from "@/services/superMagic/SuperMagicModeService"
import { MagicIcon } from "@/components/base"
import pubsub, { PubSubEvents } from "@/utils/pubsub"
import BlackPurpleButton from "@/components/other/BlackPurpleButton"
import {
	Popover,
	PopoverAnchor,
	PopoverContent,
	PopoverTrigger,
} from "@/components/shadcn-ui/popover"
import { Input } from "@/components/shadcn-ui/input"
import MagicPopup from "@/components/base-mobile/MagicPopup"
import { cn } from "@/lib/utils"
import { useIsMobile } from "@/hooks/use-mobile"
import { MessageEditorSize } from "../MessageEditor/types"
import { CollapsibleDescription } from "../MessageEditor/components/ModelSwitch/components/CollapsibleDescription"
import { DrawerTitle } from "@/components/shadcn-ui/drawer"
import ModeAvatar from "../ModeAvatar"

const TRIGGER_SIZE_MAP: Record<MessageEditorSize, string> = {
	small: "h-6 px-1.5 py-1 gap-1.5",
	default: "h-[30px] pl-1 pr-2.5 py-1.5 gap-2",
	mobile: "h-7 px-2 py-1 gap-2",
}

/** No browser / Radix focus ring; avoids outline overflow in tight layouts */
const MODE_TOGGLE_TRIGGER_CLASS = cn(
	"[WebkitTapHighlightColor:transparent] flex min-w-0 shrink-0 cursor-pointer items-center gap-2 rounded-md",
	"shadow-none outline-none ring-0 ring-offset-0",
	"hover:bg-sidebar/50 dark:bg-sidebar dark:hover:bg-muted",
	"focus:outline-none focus:ring-0 focus:ring-offset-0",
	"focus-visible:outline-none focus-visible:ring-0 focus-visible:ring-offset-0",
	"data-[state=open]:outline-none data-[state=open]:ring-0",
	"transition-all duration-200",
)
interface ModeToggleProps {
	topicMode?: TopicMode
	/** custom_agent: featured mode.identifier */
	agentCode?: string | null
	allowChangeMode: boolean
	/** When true, confirm popup copy uses chat (对话) instead of topic (话题). */
	useChatTerminology?: boolean
	onModeChange?: (mode: TopicMode) => void
	size?: MessageEditorSize
}

const TopicPlusIcon = <MagicIcon component={MessageCirclePlus} size={18} color="currentColor" />

function modeMatchesTopic(
	modeIdentifier: string,
	topicMode: TopicMode | undefined,
	agentCode?: string | null,
) {
	if (topicMode === TopicMode.CustomAgent && agentCode) return modeIdentifier === agentCode
	return modeIdentifier === topicMode
}

function isDescriptionToggleTarget(target: EventTarget | null) {
	return target instanceof HTMLElement
		? !!target.closest("[data-collapsible-description-toggle='true']")
		: false
}

function ModeToggle({
	topicMode,
	agentCode,
	allowChangeMode = true,
	useChatTerminology,
	onModeChange,
	size = "default",
}: ModeToggleProps) {
	const { t } = useTranslation("super")
	const { t: tCrewCreate } = useTranslation("crew/create")
	const isMobile = useIsMobile()
	const [open, setOpen] = useState(false)
	const [showNewTopicModal, setShowNewTopicModal] = useState<{
		visible: boolean
		mode: CrewItem["mode"] | null
	}>({
		visible: false,
		mode: null,
	})
	const [popoverOpen, setPopoverOpen] = useState(false)
	const [popoverTarget, setPopoverTarget] = useState<HTMLElement | null>(null)
	const [searchKeyword, setSearchKeyword] = useState("")
	const modeList = superMagicModeService.modeList
	const popoverTargetRef = useRef<HTMLElement | null>(null)
	const modeListScrollRef = useRef<HTMLDivElement | null>(null)
	const [expandedModeDescriptions, setExpandedModeDescriptions] = useState<
		Record<string, boolean>
	>({})

	useFeaturedModeListRefreshOnFirstOpen(open)

	const currentMode = useMemo(() => {
		if (!topicMode) return null
		return superMagicModeService.getModeConfigWithLegacy(topicMode, t, false, agentCode)
	}, [topicMode, t, agentCode])

	const isCompactList = isMobile

	const resolveModeText = useMemoizedFn((text?: string, fallback?: string) => {
		return text || fallback
	})

	const resetConfirmPopover = useMemoizedFn(() => {
		setPopoverOpen(false)
		setPopoverTarget(null)
		popoverTargetRef.current = null
	})

	const resetSearchKeyword = useMemoizedFn(() => {
		setSearchKeyword("")
	})

	const closeAllPanels = useMemoizedFn(() => {
		setOpen(false)
		resetConfirmPopover()
		resetSearchKeyword()
		setShowNewTopicModal({ visible: false, mode: null })
	})

	const filteredModeList = useMemo(() => {
		const normalizedKeyword = searchKeyword.trim().toLocaleLowerCase()

		if (!normalizedKeyword) return modeList

		return modeList?.filter((tab) => {
			const modeLabel = resolveModeText(tab.mode.name, tCrewCreate("untitledCrew"))
			const modeWithDescription = tab.mode as CrewItem["mode"]
			const modeDescription = resolveModeText(
				"description" in modeWithDescription ? modeWithDescription.description : undefined,
			)

			return [modeLabel, modeDescription].some((value) =>
				value?.toLocaleLowerCase().includes(normalizedKeyword),
			)
		})
	}, [modeList, resolveModeText, searchKeyword, tCrewCreate])

	const scrollToSelectedMode = useMemoizedFn(() => {
		const container = modeListScrollRef.current
		if (!container) return

		const selectedItem = container.querySelector("[data-selected='true']") as HTMLElement | null
		if (!selectedItem) return

		selectedItem.scrollIntoView({
			block: "nearest",
			inline: "nearest",
		})
	})

	useEffect(() => {
		if (!open) return

		const frameId = window.requestAnimationFrame(() => {
			scrollToSelectedMode()
		})

		return () => {
			window.cancelAnimationFrame(frameId)
		}
	}, [open, scrollToSelectedMode, topicMode, agentCode])

	const handleModeChange = useMemoizedFn(
		(mode: CrewItem["mode"], anchorElement?: HTMLElement | null) => {
			if (allowChangeMode) {
				onModeChange?.(mode.identifier as TopicMode)
				setOpen(false)
				return
			}

			if (modeMatchesTopic(mode.identifier, topicMode, agentCode)) {
				closeAllPanels()
				return
			}

			if (isMobile) {
				const isSameTarget =
					showNewTopicModal.visible &&
					showNewTopicModal.mode?.identifier === mode.identifier

				setShowNewTopicModal(
					isSameTarget ? { visible: false, mode: null } : { visible: true, mode },
				)
				return
			}

			const isSameTarget =
				popoverOpen && showNewTopicModal.mode?.identifier === mode.identifier

			if (isSameTarget) {
				resetConfirmPopover()
				setShowNewTopicModal({ visible: false, mode: null })
				return
			}

			setShowNewTopicModal({ visible: true, mode })
			if (anchorElement) {
				popoverTargetRef.current = anchorElement
				setPopoverTarget(anchorElement)
				setPopoverOpen(true)
			}
		},
	)

	const handleCreateNewTopic = useMemoizedFn(() => {
		const targetMode = showNewTopicModal.mode?.identifier as TopicMode

		closeAllPanels()

		setTimeout(() => {
			document.body.style.removeProperty("pointer-events")
			pubsub.publish(PubSubEvents.Create_New_Topic)
			onModeChange?.(targetMode)
		}, 0)
	})

	const renderModeIcon = useMemoizedFn((mode: CrewItem["mode"], iconSize: number) => {
		return (
			<ModeAvatar
				mode={mode}
				iconSize={iconSize}
				data-testid={`mode-toggle-icon-${mode.identifier}`}
			/>
		)
	})

	const renderSelectionIndicator = useMemoizedFn((isSelected: boolean, testId?: string) => {
		return (
			<div
				data-testid={testId}
				data-mode-option-checkbox="true"
				className={cn(
					"pointer-events-none flex size-4 shrink-0 items-center justify-center",
					!isSelected && "invisible group-hover:visible group-data-[highlighted]:visible",
				)}
			>
				<div
					className={cn(
						"flex size-4 items-center justify-center rounded-[4px] border shadow-xs transition-colors",
						isSelected
							? "border-primary bg-primary text-primary-foreground"
							: "border-input bg-background text-transparent",
					)}
				>
					{isSelected && <Check className="size-3" strokeWidth={3} />}
				</div>
			</div>
		)
	})

	function toggleModeDescription(
		modeIdentifier: string,
		event: ReactMouseEvent<HTMLButtonElement>,
	) {
		event.stopPropagation()
		setExpandedModeDescriptions((prev) => ({
			...prev,
			[modeIdentifier]: !prev[modeIdentifier],
		}))
	}

	const renderModeItemInner = useMemoizedFn(
		(tab: CrewItem, isSelected: boolean, compact: boolean) => {
			const modeLabel = resolveModeText(tab.mode.name, tCrewCreate("untitledCrew"))
			const modeDescription = resolveModeText(tab.mode.description)

			return (
				<>
					<div
						className={cn(
							"flex min-w-0 flex-1 gap-2",
							compact ? "items-center" : "items-start",
						)}
					>
						{renderModeIcon(tab.mode, 40)}
						<div
							className={cn(
								"min-w-0 flex-1",
								compact ? "flex items-center" : "flex flex-col gap-1.5",
							)}
						>
							<div className="truncate text-sm font-medium leading-none text-foreground">
								{modeLabel}
							</div>
							{!compact && modeDescription ? (
								<CollapsibleDescription
									description={modeDescription}
									isExpanded={!!expandedModeDescriptions[tab.mode.identifier]}
									expandLabel={t("messageEditor.modelSwitch.expandDescription")}
									collapseLabel={t(
										"messageEditor.modelSwitch.collapseDescription",
									)}
									onToggle={(event) =>
										toggleModeDescription(tab.mode.identifier, event)
									}
								/>
							) : null}
						</div>
					</div>
					{renderSelectionIndicator(
						isSelected,
						isSelected ? "super-message-editor-mode-toggle-item-selected" : undefined,
					)}
				</>
			)
		},
	)

	const renderStaticModeItem = useCallback(
		(tab: CrewItem) => {
			const isSelected = modeMatchesTopic(tab.mode.identifier, topicMode, agentCode)

			return (
				<div
					key={tab.mode.identifier}
					role="button"
					tabIndex={0}
					className={cn(
						"group flex w-full min-w-0 rounded-md px-2.5 py-2 text-left text-foreground transition-colors",
						isCompactList ? "items-center gap-2" : "items-start gap-2",
						"outline-none ring-0 ring-offset-0 hover:bg-sidebar-accent",
						"focus:outline-none focus:ring-0 focus:ring-offset-0",
						"focus-visible:outline-none focus-visible:ring-0 focus-visible:ring-offset-0",
					)}
					onClick={(event) => {
						if (isDescriptionToggleTarget(event.target)) {
							return
						}
						event.stopPropagation()
						handleModeChange(tab.mode, event.currentTarget)
					}}
					onKeyDown={(event) => {
						if (event.key !== "Enter" && event.key !== " ") return
						event.preventDefault()
						handleModeChange(tab.mode, event.currentTarget)
					}}
					data-testid="super-message-editor-mode-toggle-item"
					data-mode={tab.mode.identifier}
					data-mode-name={resolveModeText(tab.mode.name)}
					data-selected={isSelected}
				>
					{renderModeItemInner(tab, isSelected, isCompactList)}
				</div>
			)
		},
		[
			agentCode,
			handleModeChange,
			isCompactList,
			renderModeItemInner,
			resolveModeText,
			topicMode,
		],
	)

	const modeListContent = useMemo(() => {
		return (
			<div
				className={cn(
					"flex flex-col gap-2.5",
					isMobile ? "w-full" : isCompactList ? "w-[240px]" : "w-[320px]",
				)}
				data-testid="super-message-editor-mode-toggle-content"
			>
				<div className="text-sm font-semibold leading-5 text-foreground">
					{t("modeToggle.selectCrew")}
				</div>
				<div className="relative">
					<Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
					<Input
						value={searchKeyword}
						onChange={(event) => setSearchKeyword(event.target.value)}
						placeholder={t("modeToggle.searchPlaceholder")}
						className="h-9 bg-background pl-9"
						data-testid="super-message-editor-mode-toggle-search-input"
					/>
				</div>
				<div
					ref={modeListScrollRef}
					className={cn(
						"scrollbar-y-thin flex flex-col gap-1 overflow-y-auto",
						isCompactList ? "max-h-[236px]" : "max-h-[340px]",
					)}
				>
					{filteredModeList?.length ? (
						filteredModeList.map((tab) => renderStaticModeItem(tab))
					) : (
						<div className="px-2.5 py-6 text-center text-sm text-muted-foreground">
							{t("modeToggle.emptySearchResult")}
						</div>
					)}
				</div>
			</div>
		)
	}, [
		expandedModeDescriptions,
		filteredModeList,
		isCompactList,
		isMobile,
		renderStaticModeItem,
		searchKeyword,
		setSearchKeyword,
		t,
	])

	const confirmPopoverContent = useMemo(() => {
		const modeName = resolveModeText(showNewTopicModal.mode?.name)
		const transValues = { modeName }
		const transComponents = { strong: <strong /> }

		return (
			<div
				className={cn(
					"flex flex-col gap-3 rounded-lg",
					isMobile ? "w-full" : "max-w-[200px]",
				)}
				data-testid="super-message-editor-mode-toggle-create-topic-dialog"
			>
				<div className="text-xs leading-[18px] text-foreground">
					{useChatTerminology ? (
						<Trans
							i18nKey="modeToggle.cannotSwitchModeMessageChat"
							ns="super"
							values={transValues}
							components={transComponents}
						/>
					) : (
						<Trans
							i18nKey="modeToggle.cannotSwitchModeMessage"
							ns="super"
							values={transValues}
							components={transComponents}
						/>
					)}
				</div>
				<BlackPurpleButton
					onClick={handleCreateNewTopic}
					icon={TopicPlusIcon}
					data-testid="super-message-editor-mode-toggle-create-topic-button"
				>
					<span className="text-xs font-normal leading-4">
						{useChatTerminology
							? t("modeToggle.createNewChat")
							: t("modeToggle.createNewTopic")}
					</span>
				</BlackPurpleButton>
			</div>
		)
	}, [
		handleCreateNewTopic,
		isMobile,
		resolveModeText,
		showNewTopicModal.mode?.name,
		t,
		useChatTerminology,
	])

	const currentModeItem = useMemo(() => {
		if (!currentMode) return null

		return (
			<button
				type="button"
				className={cn(MODE_TOGGLE_TRIGGER_CLASS, TRIGGER_SIZE_MAP[size])}
				aria-expanded={open}
				aria-haspopup="dialog"
				data-testid="mode-toggle-button"
				data-mode={topicMode}
				data-disabled={!allowChangeMode}
				data-mode-name={resolveModeText(currentMode.mode.name)}
			>
				{renderModeIcon(currentMode.mode, size === "small" ? 16 : 24)}
				<div
					className={cn(
						"max-w-full overflow-hidden text-ellipsis whitespace-nowrap font-medium leading-4 text-foreground",
						size === "small" ? "text-xs" : "text-sm",
					)}
				>
					{resolveModeText(currentMode.mode.name)}
				</div>
				<ChevronsUpDown
					className={cn(
						"shrink-0 text-foreground",
						size === "small" ? "size-3" : "size-4",
					)}
				/>
			</button>
		)
	}, [allowChangeMode, currentMode, open, renderModeIcon, resolveModeText, size, topicMode])

	if (!topicMode && !isString(topicMode)) {
		return null
	}

	if (isMobile) {
		return (
			<div
				className="relative w-fit min-w-0"
				data-testid="super-message-editor-mode-toggle-root"
			>
				<div className="w-fit min-w-0 rounded-md" onClick={() => setOpen(true)}>
					{currentModeItem}
				</div>
				<MagicPopup
					visible={open}
					onClose={() => {
						setOpen(false)
						resetSearchKeyword()
						resetConfirmPopover()
					}}
					position="top"
					className="z-popup"
					title={t("modeToggle.selectCrew")}
				>
					<DrawerTitle className="sr-only">{t("modeToggle.selectCrew")}</DrawerTitle>
					<div className="px-4 pb-4">{modeListContent}</div>
				</MagicPopup>
				{!allowChangeMode ? (
					<MagicPopup
						visible={showNewTopicModal.visible}
						onClose={() => {
							setShowNewTopicModal({ visible: false, mode: null })
						}}
						position="top"
						title={t("modeToggle.selectCrew")}
					>
						<div className="flex flex-col gap-4 p-4">{confirmPopoverContent}</div>
					</MagicPopup>
				) : null}
			</div>
		)
	}

	if (allowChangeMode) {
		return (
			<div
				className={cn("relative w-fit min-w-0")}
				data-testid="super-message-editor-mode-toggle-root"
			>
				<Popover
					open={open}
					onOpenChange={(nextOpen) => {
						setOpen(nextOpen)
						if (!nextOpen) {
							resetSearchKeyword()
							resetConfirmPopover()
						}
					}}
				>
					<PopoverTrigger asChild>{currentModeItem}</PopoverTrigger>
					<PopoverContent
						side="top"
						align="start"
						className="z-dropdown w-auto overflow-hidden p-2.5 outline-none focus-visible:outline-none focus-visible:ring-0 focus-visible:ring-offset-0"
					>
						{modeListContent}
					</PopoverContent>
				</Popover>
			</div>
		)
	}

	return (
		<div className="relative w-fit min-w-0" data-testid="super-message-editor-mode-toggle-root">
			<Popover
				open={open}
				onOpenChange={(nextOpen) => {
					setOpen(nextOpen)
					if (!nextOpen) {
						resetSearchKeyword()
						resetConfirmPopover()
						setShowNewTopicModal({ visible: false, mode: null })
					}
				}}
			>
				<PopoverTrigger asChild>{currentModeItem}</PopoverTrigger>
				<PopoverContent
					side="top"
					align="start"
					className="z-dropdown w-auto overflow-hidden p-2.5 outline-none focus-visible:outline-none focus-visible:ring-0 focus-visible:ring-offset-0"
					onInteractOutside={(event) => {
						const target = event.target as HTMLElement | null
						if (target?.closest?.("[data-mode-confirm-popover='true']")) {
							event.preventDefault()
						}
					}}
				>
					{modeListContent}
				</PopoverContent>
			</Popover>
			<Popover
				open={popoverOpen && !!popoverTarget}
				onOpenChange={(nextOpen) => {
					setPopoverOpen(nextOpen)
					if (!nextOpen) {
						setPopoverTarget(null)
						popoverTargetRef.current = null
					}
				}}
			>
				<PopoverAnchor virtualRef={popoverTargetRef as RefObject<HTMLElement>} />
				<PopoverContent
					data-mode-confirm-popover="true"
					side="left"
					className="z-dropdown w-auto p-3 outline-none focus-visible:outline-none focus-visible:ring-0 focus-visible:ring-offset-0"
					onOpenAutoFocus={(event) => event.preventDefault()}
					onCloseAutoFocus={(event) => event.preventDefault()}
				>
					{confirmPopoverContent}
				</PopoverContent>
			</Popover>
		</div>
	)
}

export default observer(ModeToggle)
