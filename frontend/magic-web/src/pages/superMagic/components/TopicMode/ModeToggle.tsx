import {
	memo,
	useCallback,
	useMemo,
	useRef,
	useState,
	type MouseEvent as ReactMouseEvent,
	type RefObject,
} from "react"
import { useTranslation, Trans } from "react-i18next"
import { isString } from "lodash-es"
import { useMemoizedFn } from "ahooks"
import { Check, ChevronsUpDown, MessageCirclePlus } from "lucide-react"
import { CrewItem, TopicMode } from "../../pages/Workspace/types"
import { useModeList } from "../MessagePanel/hooks/usePatternTabs"
import superMagicModeService from "@/services/superMagic/SuperMagicModeService"
import IconComponent from "@/pages/superMagic/components/IconViewComponent/index"
import { MagicIcon } from "@/components/base"
import pubsub, { PubSubEvents } from "@/utils/pubsub"
import BlackPurpleButton from "@/components/other/BlackPurpleButton"
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/components/shadcn-ui/dropdown-menu"
import {
	Popover,
	PopoverAnchor,
	PopoverContent,
	PopoverTrigger,
} from "@/components/shadcn-ui/popover"
import MagicPopup from "@/components/base-mobile/MagicPopup"
import { cn } from "@/lib/utils"
import { useIsMobile } from "@/hooks/use-mobile"
import { MessageEditorSize } from "../MessageEditor/types"
import { DrawerTitle } from "@/components/shadcn-ui/drawer"
import ModeAvatar from "../ModeAvatar"

const TRIGGER_SIZE_MAP: Record<MessageEditorSize, string> = {
	small: "h-6 px-1.5 py-1",
	default: "h-[30px] px-2.5 py-1.5",
	mobile: "h-7 px-2 py-1",
}

interface ModeToggleProps {
	topicMode?: TopicMode
	allowChangeMode: boolean
	onModeChange?: (mode: TopicMode) => void
	size?: MessageEditorSize
}

const TopicPlusIcon = <MagicIcon component={MessageCirclePlus} size={18} color="currentColor" />

function ModeToggle({
	topicMode,
	allowChangeMode = true,
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
	const { modeList } = useModeList({ includeChat: false })
	const popoverTargetRef = useRef<HTMLElement | null>(null)

	const currentMode = useMemo(() => {
		if (!topicMode) return null
		return superMagicModeService.getModeConfigWithLegacy(topicMode, t)
	}, [topicMode, t])

	const isCompactList = isMobile || !allowChangeMode

	const resolveModeText = useMemoizedFn((text?: string, fallback?: string) => {
		if (!text) return fallback
		const translated = t(text)
		return translated === text ? text : translated
	})

	const resetConfirmPopover = useMemoizedFn(() => {
		setPopoverOpen(false)
		setPopoverTarget(null)
		popoverTargetRef.current = null
	})

	const closeAllPanels = useMemoizedFn(() => {
		setOpen(false)
		resetConfirmPopover()
		setShowNewTopicModal({ visible: false, mode: null })
	})

	const handleModeChange = useMemoizedFn(
		(mode: CrewItem["mode"], event?: ReactMouseEvent<HTMLElement>) => {
			if (allowChangeMode) {
				onModeChange?.(mode.identifier as TopicMode)
				setOpen(false)
				return
			}

			if (mode.identifier === topicMode) {
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
			if (event?.currentTarget) {
				popoverTargetRef.current = event.currentTarget
				setPopoverTarget(event.currentTarget)
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
								<div className="text-xs leading-4 text-muted-foreground">
									{modeDescription}
								</div>
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

	const renderDropdownModeItem = useCallback(
		(tab: CrewItem) => {
			const isSelected = topicMode === tab.mode.identifier

			return (
				<DropdownMenuItem
					key={tab.mode.identifier}
					className={cn(
						"group min-w-0 cursor-pointer rounded-md px-2.5 py-2 text-foreground outline-none",
						isCompactList ? "flex items-center gap-2" : "flex items-start gap-2",
						"focus:bg-transparent focus:text-foreground data-[highlighted]:bg-sidebar-accent data-[highlighted]:text-foreground",
					)}
					onClick={(event) => {
						event.stopPropagation()
						handleModeChange(tab.mode, event)
					}}
					data-testid="super-message-editor-mode-toggle-item"
					data-mode={tab.mode.identifier}
					data-mode-name={resolveModeText(tab.mode.name)}
					data-selected={isSelected}
				>
					{renderModeItemInner(tab, isSelected, isCompactList)}
				</DropdownMenuItem>
			)
		},
		[handleModeChange, isCompactList, renderModeItemInner, resolveModeText, topicMode],
	)

	const renderStaticModeItem = useCallback(
		(tab: CrewItem) => {
			const isSelected = topicMode === tab.mode.identifier

			return (
				<button
					key={tab.mode.identifier}
					type="button"
					className={cn(
						"group flex w-full min-w-0 rounded-md px-2.5 py-2 text-left text-foreground transition-colors",
						isCompactList ? "items-center gap-2" : "items-start gap-2",
						"hover:bg-sidebar-accent",
					)}
					onClick={(event) => {
						event.stopPropagation()
						handleModeChange(tab.mode, event)
					}}
					data-testid="super-message-editor-mode-toggle-item"
					data-mode={tab.mode.identifier}
					data-mode-name={resolveModeText(tab.mode.name)}
					data-selected={isSelected}
				>
					{renderModeItemInner(tab, isSelected, isCompactList)}
				</button>
			)
		},
		[handleModeChange, isCompactList, renderModeItemInner, resolveModeText, topicMode],
	)

	const shouldUseDropdownModeItem = allowChangeMode && !isMobile

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
				<div
					className={cn(
						"scrollbar-y-thin flex flex-col gap-1 overflow-y-auto",
						isCompactList ? "max-h-[236px]" : "max-h-[340px]",
					)}
				>
					{modeList?.map((tab) =>
						shouldUseDropdownModeItem
							? renderDropdownModeItem(tab)
							: renderStaticModeItem(tab),
					)}
				</div>
			</div>
		)
	}, [
		isCompactList,
		isMobile,
		modeList,
		renderDropdownModeItem,
		renderStaticModeItem,
		shouldUseDropdownModeItem,
		t,
	])

	const confirmPopoverContent = useMemo(() => {
		return (
			<div
				className={cn(
					"flex flex-col gap-3 rounded-lg",
					isMobile ? "w-full" : "max-w-[200px]",
				)}
				data-testid="super-message-editor-mode-toggle-create-topic-dialog"
			>
				<div className="text-xs leading-[18px] text-foreground">
					<Trans
						i18nKey="modeToggle.cannotSwitchModeMessage"
						ns="super"
						values={{
							modeName: resolveModeText(showNewTopicModal.mode?.name),
						}}
						components={{
							strong: <strong />,
						}}
					/>
				</div>
				<BlackPurpleButton
					onClick={handleCreateNewTopic}
					icon={TopicPlusIcon}
					data-testid="super-message-editor-mode-toggle-create-topic-button"
				>
					<span className="text-xs font-normal leading-4">
						{t("modeToggle.createNewTopic")}
					</span>
				</BlackPurpleButton>
			</div>
		)
	}, [handleCreateNewTopic, isMobile, resolveModeText, showNewTopicModal.mode?.name, t])

	const currentModeItem = useMemo(() => {
		if (!currentMode) return null

		return (
			<div
				className={cn(
					"[WebkitTapHighlightColor:transparent] flex shrink-0 cursor-pointer items-center gap-2 outline-none hover:bg-sidebar/50 focus:outline-none focus:ring-0 focus:ring-offset-0 focus-visible:outline-none focus-visible:ring-0 focus-visible:ring-offset-0 dark:bg-sidebar dark:hover:bg-muted",
					TRIGGER_SIZE_MAP[size],
				)}
				data-testid="mode-toggle-button"
				data-mode={topicMode}
				data-disabled={!allowChangeMode}
				data-mode-name={resolveModeText(currentMode.mode.name)}
			>
				{renderModeIcon(currentMode.mode, 16)}
				<div className="max-w-20 overflow-hidden text-ellipsis whitespace-nowrap text-xs font-medium leading-4 text-foreground">
					{resolveModeText(currentMode.mode.name)}
				</div>
				<ChevronsUpDown className="size-4 shrink-0 text-foreground" />
			</div>
		)
	}, [allowChangeMode, currentMode, renderModeIcon, resolveModeText, size, topicMode])

	if (!topicMode && !isString(topicMode)) {
		return null
	}

	if (isMobile) {
		return (
			<div className="relative" data-testid="super-message-editor-mode-toggle-root">
				<div className="w-fit" onClick={() => setOpen(true)}>
					{currentModeItem}
				</div>
				<MagicPopup
					visible={open}
					onClose={() => {
						setOpen(false)
						resetConfirmPopover()
					}}
					position="bottom"
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
						position="bottom"
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
				className={cn("relative", "w-fit")}
				data-testid="super-message-editor-mode-toggle-root"
			>
				<DropdownMenu
					open={open}
					onOpenChange={(nextOpen) => {
						setOpen(nextOpen)
						if (!nextOpen) {
							resetConfirmPopover()
						}
					}}
				>
					<DropdownMenuTrigger asChild>{currentModeItem}</DropdownMenuTrigger>
					<DropdownMenuContent
						align="start"
						className="z-dropdown w-auto overflow-hidden p-2.5 outline-none focus-visible:outline-none focus-visible:ring-0 focus-visible:ring-offset-0"
					>
						{modeListContent}
					</DropdownMenuContent>
				</DropdownMenu>
			</div>
		)
	}

	return (
		<div className="relative" data-testid="super-message-editor-mode-toggle-root">
			<Popover
				open={open}
				onOpenChange={(nextOpen) => {
					setOpen(nextOpen)
					if (!nextOpen) {
						resetConfirmPopover()
						setShowNewTopicModal({ visible: false, mode: null })
					}
				}}
			>
				<PopoverTrigger asChild>{currentModeItem}</PopoverTrigger>
				<PopoverContent
					side="bottom"
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

export default memo(ModeToggle)
