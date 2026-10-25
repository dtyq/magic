import { useIsMobile } from "@/hooks/useIsMobile"
import { cn } from "@/utils/cn"
import {
	CONVERSATION_INPUT_HEIGHT_CONFIG,
	DEFAULT_COMPOSER_MIN_INPUT_HEIGHT,
} from "@/pages/superMagic/components/ConversationInputResize/constants"
import { INPUT_CONTAINER_MIN_HEIGHT } from "@/pages/superMagic/components/MainInputContainer/constants"
import MessageList, { MessageListProvider } from "@/pages/superMagic/components/MessageList"
import type { MessageListContextState } from "@/pages/superMagic/components/MessageList/context"
import type { SuperMagicMessageItem } from "@/pages/superMagic/components/MessageList/type"
import type { SendMessageOptions } from "@/pages/superMagic/components/MessagePanel/types"
import type { SceneEditorNodes } from "@/pages/superMagic/components/MainInputContainer/components/editors/types"
import type { TaskStatus, Topic } from "@/pages/superMagic/pages/Workspace/types"
import type { RevokedMessageEditorContext } from "@/pages/superMagic/components/MessageList/revoked-editor-context"
import {
	cloneElement,
	isValidElement,
	memo,
	type ReactElement,
	type ReactNode,
	useEffect,
	useLayoutEffect,
	useMemo,
	useRef,
	useState,
} from "react"
import ConversationInputResizeHandle from "@/pages/superMagic/components/ConversationInputResize/ConversationInputResizeHandle"
import { ConversationInputLayoutProvider } from "@/pages/superMagic/components/ConversationInputResize/context"
import { useConversationInputHeight } from "@/pages/superMagic/components/ConversationInputResize/useConversationInputHeight"

/** Reuse the project composer chrome with a slightly tighter toolbar rhythm for opt-in panels. */
const DESKTOP_COMPOSER_SHELL_CLASSNAME =
	"flex-none items-start gap-1.5 self-stretch rounded-2xl border border-border bg-sidebar p-2"

interface ConversationPanelScaffoldProps {
	scope: string
	header?: ReactNode
	emptyHero: ReactNode
	emptyCompact: ReactNode
	editor: ReactNode
	messageListProviderValue: MessageListContextState
	messages: Array<SuperMagicMessageItem>
	selectedTopic: Topic | null
	setSelectedDetail?: (detail: unknown) => void
	onFileClick?: (fileItem: unknown) => void
	isConversationPanelCollapsed?: boolean
	detailPanelVisible?: boolean
	showLoading?: boolean
	currentTopicStatus?: TaskStatus
	isMessagesLoading?: boolean
	emptyHint?: ReactNode
	handlePullMoreMessage?: (
		selectedTopic: Topic | null,
		callback?: () => void,
	) => void | Promise<unknown>
	/** Distance from the top at which a fresh upward gesture may load one history page. */
	historyLoadThresholdPx?: number
	handleSendMsg?: (content: string, options?: SendMessageOptions) => void
	rootTestId?: string
	editorTestId?: string
	className?: string
	stickyMessageClassName?: string
	/**
	 * Reserve space at bottom of message scroll area so content clears the editor.
	 * Default matches desktop Topic editor min height; mobile compact UIs should pass a smaller value.
	 */
	messageLayoutPaddingBottomPx?: number
	/** Fade messages into editor area (e.g. mobile compact layout) */
	messageListBottomFade?: boolean
	/** Optional Tailwind classes for the bottom fade layer */
	messageListBottomFadeClassName?: string
	/** Pass-through to MessageList BackToLatestButton (e.g. offset above fade) */
	backToLatestButtonClassName?: string
	enableRevokedUserMessageReedit?: boolean
	revokedEditorContext?: RevokedMessageEditorContext
	/** Task list + message queue above editor (e.g. Topic message queue) */
	editorNodes?: SceneEditorNodes
	/** Optional page-specific offset for the desktop input resize handle. */
	resizeHandlePositionClassName?: string
	/** Wrap this desktop composer with the same shell used by project topics. */
	desktopComposerShell?: boolean
}

interface AnimatedEmptyStateProps {
	iconAnimationDirection?: "enter" | "exit"
	iconSoundEnabled?: boolean
}

const EMPTY_LAYOUT_TRANSITION_MS = 300
const CENTERED_EMPTY_EDITOR_GAP_PX = 24
const CENTERED_EMPTY_HINT_GAP_PX = 24
const CENTERED_EMPTY_LAYOUT_EDGE_PADDING_PX = 32

interface PreviousConversationState {
	selectedTopicId: string | null
	shouldShowCenteredEmptyState: boolean
}

interface EmptyLayoutMeasurements {
	containerHeight: number
	heroHeight: number
	editorHeight: number
	hintHeight: number
}

function ConversationPanelScaffold({
	scope,
	header,
	emptyHero,
	emptyCompact,
	editor,
	messageListProviderValue,
	messages,
	selectedTopic,
	setSelectedDetail,
	onFileClick,
	isConversationPanelCollapsed = false,
	detailPanelVisible = true,
	showLoading,
	currentTopicStatus,
	isMessagesLoading,
	emptyHint,
	handlePullMoreMessage,
	handleSendMsg,
	rootTestId,
	editorTestId,
	className,
	stickyMessageClassName,
	messageLayoutPaddingBottomPx = INPUT_CONTAINER_MIN_HEIGHT.TopicPage,
	messageListBottomFade = false,
	messageListBottomFadeClassName,
	backToLatestButtonClassName,
	historyLoadThresholdPx,
	enableRevokedUserMessageReedit,
	revokedEditorContext,
	editorNodes,
	resizeHandlePositionClassName,
	desktopComposerShell = false,
}: ConversationPanelScaffoldProps) {
	/** 与全局移动端判定一致，用于在窄屏下去掉根容器多余底边距，避免与全屏输入区叠出双份留白 */
	const isMobile = useIsMobile()
	const [measuredBottomPanelHeightPx, setMeasuredBottomPanelHeightPx] = useState(0)
	const [isInputResizing, setIsInputResizing] = useState(false)
	const measuredBottomPanelHeightRef = useRef(0)
	const bottomPanelMeasureFrameRef = useRef<number | null>(null)

	const hasMessages = messages.length > 0
	const shouldShowCenteredEmptyState = !detailPanelVisible && !isMessagesLoading && !hasMessages
	const [shouldPreserveCenteredEmptyState, setShouldPreserveCenteredEmptyState] = useState(false)
	const [shouldRenderCompactFallback, setShouldRenderCompactFallback] = useState(
		!shouldShowCenteredEmptyState,
	)
	const [shouldUseAnchoredEmptyLayout, setShouldUseAnchoredEmptyLayout] = useState(false)
	const [emptyLayoutMeasurements, setEmptyLayoutMeasurements] = useState<EmptyLayoutMeasurements>(
		{
			containerHeight: 0,
			heroHeight: 0,
			editorHeight: 0,
			hintHeight: 0,
		},
	)
	const previousStateRef = useRef<PreviousConversationState>({
		selectedTopicId: selectedTopic?.id ?? null,
		shouldShowCenteredEmptyState,
	})
	const bodyRef = useRef<HTMLDivElement>(null)
	const emptyHeroRef = useRef<HTMLDivElement>(null)
	const emptyHintRef = useRef<HTMLDivElement>(null)
	const editorLayoutRef = useRef<HTMLDivElement>(null)
	const isCenteredEmptyStateVisible =
		shouldShowCenteredEmptyState || shouldPreserveCenteredEmptyState
	const inputEnabled = !isMobile && !isConversationPanelCollapsed && !isCenteredEmptyStateVisible
	const inputHeight = useConversationInputHeight({
		scope,
		enabled: inputEnabled,
		containerRef: editorLayoutRef,
		availableRef: bodyRef,
		minHeight: DEFAULT_COMPOSER_MIN_INPUT_HEIGHT,
		...CONVERSATION_INPUT_HEIGHT_CONFIG,
	})
	const effectiveInputMinHeight = inputHeight.minHeight ?? DEFAULT_COMPOSER_MIN_INPUT_HEIGHT
	const inputLayoutContext = useMemo(
		() => ({
			fillHeight: inputHeight.fillHeight,
			queueListMaxHeight: inputHeight.enabled ? inputHeight.queueListMaxHeight : undefined,
		}),
		[inputHeight.fillHeight, inputHeight.enabled, inputHeight.queueListMaxHeight],
	)
	const renderedEmptyHero = isValidElement(emptyHero)
		? cloneElement(emptyHero as ReactElement<AnimatedEmptyStateProps>, {
				iconAnimationDirection: isCenteredEmptyStateVisible ? "enter" : "exit",
				iconSoundEnabled:
					(emptyHero as ReactElement<AnimatedEmptyStateProps>).props.iconSoundEnabled ??
					isCenteredEmptyStateVisible,
			})
		: emptyHero

	useEffect(() => {
		const previousState = previousStateRef.current
		const didTopicChange = previousState.selectedTopicId !== (selectedTopic?.id ?? null)
		const shouldKeepPreviousEmptyState =
			didTopicChange &&
			previousState.shouldShowCenteredEmptyState &&
			!detailPanelVisible &&
			!hasMessages &&
			Boolean(isMessagesLoading)

		if (shouldKeepPreviousEmptyState) {
			setShouldPreserveCenteredEmptyState(true)
			return
		}

		if (hasMessages || detailPanelVisible || !isMessagesLoading) {
			setShouldPreserveCenteredEmptyState(false)
		}
	}, [
		detailPanelVisible,
		hasMessages,
		isMessagesLoading,
		selectedTopic?.id,
		shouldShowCenteredEmptyState,
	])

	useEffect(() => {
		previousStateRef.current = {
			selectedTopicId: selectedTopic?.id ?? null,
			shouldShowCenteredEmptyState,
		}
	}, [selectedTopic?.id, shouldShowCenteredEmptyState])

	// Bottom stack height (queue + task strip + editor): drives MessageList padding
	useLayoutEffect(() => {
		const el = editorLayoutRef.current
		if (!el || typeof ResizeObserver === "undefined") return

		function applyHeight() {
			const node = editorLayoutRef.current
			if (!node) return
			const nextHeight = node.getBoundingClientRect().height
			if (Math.abs(measuredBottomPanelHeightRef.current - nextHeight) < 1) return
			measuredBottomPanelHeightRef.current = nextHeight
			setMeasuredBottomPanelHeightPx(nextHeight)
		}

		function scheduleHeightMeasurement() {
			if (bottomPanelMeasureFrameRef.current !== null) return
			bottomPanelMeasureFrameRef.current = window.requestAnimationFrame(() => {
				bottomPanelMeasureFrameRef.current = null
				applyHeight()
			})
		}

		applyHeight()
		const ro = new ResizeObserver(scheduleHeightMeasurement)
		ro.observe(el)
		return () => {
			ro.disconnect()
			if (bottomPanelMeasureFrameRef.current !== null) {
				window.cancelAnimationFrame(bottomPanelMeasureFrameRef.current)
				bottomPanelMeasureFrameRef.current = null
			}
		}
	}, [isConversationPanelCollapsed, selectedTopic?.id])

	useEffect(() => {
		if (isCenteredEmptyStateVisible) {
			setShouldRenderCompactFallback(false)
			return
		}

		if (hasMessages || isMessagesLoading) {
			setShouldRenderCompactFallback(true)
			return
		}

		const timerId = window.setTimeout(() => {
			setShouldRenderCompactFallback(true)
		}, EMPTY_LAYOUT_TRANSITION_MS)

		return () => window.clearTimeout(timerId)
	}, [hasMessages, isCenteredEmptyStateVisible, isMessagesLoading])

	useLayoutEffect(() => {
		if (!isCenteredEmptyStateVisible) {
			setShouldUseAnchoredEmptyLayout(false)
			return
		}

		function updateLayoutMode() {
			const containerHeight = bodyRef.current?.getBoundingClientRect().height ?? 0
			const heroHeight = emptyHeroRef.current?.getBoundingClientRect().height ?? 0
			const editorHeight = editorLayoutRef.current?.getBoundingClientRect().height ?? 0
			const hintHeight = emptyHintRef.current?.getBoundingClientRect().height ?? 0

			if (!containerHeight || !heroHeight || !editorHeight) return

			const nextMeasurements = {
				containerHeight,
				heroHeight,
				editorHeight,
				hintHeight,
			}
			const centeredContentHeight = heroHeight + editorHeight + CENTERED_EMPTY_EDITOR_GAP_PX
			const requiredHeight =
				centeredContentHeight +
				(hintHeight > 0 ? hintHeight + CENTERED_EMPTY_HINT_GAP_PX : 0) +
				CENTERED_EMPTY_LAYOUT_EDGE_PADDING_PX * 2

			setEmptyLayoutMeasurements(nextMeasurements)
			setShouldUseAnchoredEmptyLayout(requiredHeight > containerHeight)
		}

		updateLayoutMode()

		if (typeof ResizeObserver === "undefined") return

		const resizeObserver = new ResizeObserver(() => {
			updateLayoutMode()
		})
		const observedElements = [
			bodyRef.current,
			emptyHeroRef.current,
			emptyHintRef.current,
			editorLayoutRef.current,
		]

		observedElements.forEach((element) => {
			if (!element) return
			resizeObserver.observe(element)
		})

		return () => {
			resizeObserver.disconnect()
		}
	}, [emptyHint, isCenteredEmptyStateVisible])

	const centeredGroupHeight =
		emptyLayoutMeasurements.heroHeight +
		emptyLayoutMeasurements.editorHeight +
		CENTERED_EMPTY_EDITOR_GAP_PX
	const centeredGroupTop = Math.max(
		CENTERED_EMPTY_LAYOUT_EDGE_PADDING_PX,
		(emptyLayoutMeasurements.containerHeight - centeredGroupHeight) / 2,
	)
	const centeredEditorTop =
		centeredGroupTop + emptyLayoutMeasurements.heroHeight + CENTERED_EMPTY_EDITOR_GAP_PX

	const effectiveMessageLayoutPaddingBottomPx =
		measuredBottomPanelHeightPx > 0 ? measuredBottomPanelHeightPx : messageLayoutPaddingBottomPx
	const editorLayoutStyle = isCenteredEmptyStateVisible
		? shouldUseAnchoredEmptyLayout
			? undefined
			: { top: centeredEditorTop }
		: inputHeight.fillHeight
			? { height: inputHeight.effectiveHeight }
			: undefined
	const rootTransitionClass = isInputResizing ? "transition-none" : "transition-all duration-300"
	const layoutTransitionClass = isInputResizing
		? "transition-none"
		: "transition-all duration-300 ease-out"

	return (
		<div
			className={cn(
				"relative z-10 flex h-full flex-col items-center overflow-hidden",
				rootTransitionClass,
				!isConversationPanelCollapsed ? "rounded-lg" : "px-0 pb-0",
				className,
			)}
			data-testid={rootTestId || `${scope}-panel`}
		>
			{header}
			{/* Keep the scroll viewport in layout so native scroll anchoring preserves the reading position. */}
			<div
				className={cn(
					"relative min-h-0 w-full flex-1 overflow-hidden",
					isConversationPanelCollapsed && "invisible",
				)}
				ref={bodyRef}
				data-testid={`${scope}-body`}
			>
				<div
					className={cn(
						"absolute inset-0",
						layoutTransitionClass,
						isCenteredEmptyStateVisible
							? "translate-y-0 opacity-100"
							: "pointer-events-none -translate-y-4 opacity-0",
					)}
					data-testid={`${scope}-empty-layout`}
				>
					{shouldUseAnchoredEmptyLayout ? (
						<div
							className="mx-auto flex h-full w-full max-w-[1024px] flex-col overflow-y-auto px-4"
							style={{
								paddingBottom:
									messageLayoutPaddingBottomPx + CENTERED_EMPTY_EDITOR_GAP_PX,
							}}
						>
							<div className="flex min-h-full flex-1 flex-col items-center justify-center">
								<div
									ref={emptyHeroRef}
									className="flex w-full max-w-[768px] flex-col items-center justify-center gap-6 py-8 text-center transition-all duration-300 ease-out"
								>
									{renderedEmptyHero}
								</div>
							</div>
						</div>
					) : (
						<div className="relative mx-auto h-full w-full max-w-[1024px] px-4">
							<div
								ref={emptyHeroRef}
								className="absolute left-1/2 w-full max-w-[768px] -translate-x-1/2 transition-all duration-300 ease-out"
								style={{
									top: centeredGroupTop,
								}}
							>
								{renderedEmptyHero}
							</div>
						</div>
					)}
				</div>

				<div
					className={cn(
						"absolute inset-0",
						layoutTransitionClass,
						isCenteredEmptyStateVisible
							? "pointer-events-none translate-y-4 opacity-0"
							: "translate-y-0 opacity-100",
					)}
					style={{
						paddingBottom: effectiveMessageLayoutPaddingBottomPx,
					}}
					data-testid={`${scope}-message-layout`}
				>
					<MessageListProvider value={messageListProviderValue}>
						<MessageList
							// The scaffold owns responsive spacing and its panel surface.
							className={
								isMobile
									? "[--message-list-sticky-fade-height:0px] [--message-list-surface:rgb(var(--mobile-background-rgb))]"
									: "[--message-list-surface:rgb(var(--sidebar-rgb))]"
							}
							classNames={{ content: isMobile ? "px-4 pt-[10px]" : "pl-2 pt-[10px]" }}
							scrollEdgeFade={isMobile}
							data={messages}
							selectedTopic={selectedTopic}
							setSelectedDetail={setSelectedDetail}
							onFileClick={onFileClick}
							handlePullMoreMessage={handlePullMoreMessage}
							showLoading={showLoading}
							currentTopicStatus={currentTopicStatus}
							handleSendMsg={handleSendMsg}
							isMessagesLoading={isMessagesLoading}
							historyLoadThresholdPx={historyLoadThresholdPx}
							fallbackRender={
								shouldRenderCompactFallback ? (
									emptyCompact
								) : (
									<div className="h-full w-full" />
								)
							}
							stickyMessageClassName={stickyMessageClassName}
							backToLatestButtonClassName={backToLatestButtonClassName}
							enableRevokedUserMessageReedit={enableRevokedUserMessageReedit}
							revokedEditorContext={revokedEditorContext}
						/>
					</MessageListProvider>
				</div>

				<div
					className={cn(
						"absolute inset-x-0 z-[1] mx-auto w-full [&>*]:w-full",
						layoutTransitionClass,
						isCenteredEmptyStateVisible
							? shouldUseAnchoredEmptyLayout
								? "bottom-0 max-w-[768px] px-4 pb-4 sm:pb-6"
								: "max-w-[768px] px-4"
							: "bottom-0 max-w-3xl translate-y-0 px-0 pb-0",
					)}
					style={editorLayoutStyle}
					ref={editorLayoutRef}
					data-testid={editorTestId || `${scope}-editor-layout`}
				>
					{messageListBottomFade && !isCenteredEmptyStateVisible ? (
						<div
							className={cn(
								"pointer-events-none absolute -top-6 left-0 right-0 z-0 h-14 max-h-[30vh] min-h-10",
								"bg-gradient-to-t from-sidebar from-25% via-sidebar/55 to-transparent",
								messageListBottomFadeClassName,
							)}
							aria-hidden
							data-testid={`${scope}-editor-top-fade`}
						/>
					) : null}
					<ConversationInputLayoutProvider value={inputLayoutContext}>
						<div
							className={cn(
								"relative z-[1] flex w-full flex-col items-center",
								desktopComposerShell &&
									!isMobile &&
									DESKTOP_COMPOSER_SHELL_CLASSNAME,
								inputHeight.fillHeight && "h-full min-h-0",
							)}
							data-testid={
								desktopComposerShell && !isMobile
									? `${scope}-composer-shell`
									: undefined
							}
						>
							<div
								className="flex w-full shrink-0 flex-col gap-2 [&:empty]:hidden"
								data-conversation-input-accessory
							>
								{/* Keep task and queue chrome measurable and non-shrinking in fixed-height mode. */}
								{editorNodes?.taskDataNode}
								{editorNodes?.messageQueueNode}
							</div>
							<div
								className={cn(
									"relative w-full",
									inputHeight.fillHeight && "min-h-0 flex-1",
								)}
							>
								{inputHeight.enabled && (
									<ConversationInputResizeHandle
										value={inputHeight.effectiveHeight}
										min={effectiveInputMinHeight}
										max={inputHeight.maxHeight}
										positionClassName={resizeHandlePositionClassName}
										onResizeStart={inputHeight.startPointerResize}
										onResize={inputHeight.resizeByPointerDelta}
										onResizeEnd={inputHeight.finishPointerResize}
										onDoubleClick={inputHeight.restoreAutoHeight}
										onResizeStateChange={setIsInputResizing}
									/>
								)}
								{editor}
							</div>
							{isCenteredEmptyStateVisible && emptyHint ? (
								<div
									ref={emptyHintRef}
									className={cn(
										"flex justify-center px-4 text-center text-sm leading-6 text-foreground",
										shouldUseAnchoredEmptyLayout
											? "mt-6 w-full"
											: "pointer-events-none absolute left-1/2 top-full mt-6 w-full max-w-[560px] -translate-x-1/2",
									)}
									data-testid={`${scope}-empty-hint`}
								>
									{emptyHint}
								</div>
							) : null}
						</div>
					</ConversationInputLayoutProvider>
				</div>
			</div>
		</div>
	)
}

export default memo(ConversationPanelScaffold)
