import { useRef, type ReactNode } from "react"
import MagicSplitter from "@/components/base/MagicSplitter"
import { cn } from "@/utils/cn"
import {
	CONVERSATION_INPUT_HEIGHT_CONFIG,
	DEFAULT_COMPOSER_MIN_INPUT_HEIGHT,
} from "@/pages/superMagic/components/ConversationInputResize/constants"
import ConversationInputResizeHandle from "@/pages/superMagic/components/ConversationInputResize/ConversationInputResizeHandle"
import { ConversationInputLayoutProvider } from "@/pages/superMagic/components/ConversationInputResize/context"
import { useConversationInputHeight } from "@/pages/superMagic/components/ConversationInputResize/useConversationInputHeight"

interface ChatProjectMessageLayoutProps {
	messageList: ReactNode
	input: ReactNode
	isConversationPanelCollapsed: boolean
	scope?: string
	/** Identifies employee/mode changes that should preserve an already expanded input. */
	layoutKey?: string
	/** Allow callers with extra input controls to raise the shared minimum height. */
	inputMinHeight?: number
}

/**
 * Panel sizes are driven by useConversationInputHeight and every drag handle lives outside the Splitter,
 * so the Splitter never resizes itself. Ant Design still requires onResize when a panel has a controlled size.
 */
const NOOP_SPLITTER_RESIZE = () => undefined

/** Arrange project conversation content while sharing the desktop input height state machine. */
export default function ChatProjectMessageLayout({
	messageList,
	input,
	isConversationPanelCollapsed,
	scope = "topic-page",
	layoutKey,
	inputMinHeight,
}: ChatProjectMessageLayoutProps) {
	const layoutRef = useRef<HTMLDivElement>(null)
	const inputRef = useRef<HTMLDivElement>(null)
	const baseInputMinHeight = inputMinHeight ?? DEFAULT_COMPOSER_MIN_INPUT_HEIGHT
	const inputHeight = useConversationInputHeight({
		scope,
		layoutKey,
		enabled: !isConversationPanelCollapsed,
		containerRef: inputRef,
		availableRef: layoutRef,
		minHeight: baseInputMinHeight,
		...CONVERSATION_INPUT_HEIGHT_CONFIG,
	})
	const effectiveInputMinHeight = inputHeight.minHeight ?? baseInputMinHeight
	// 尺寸仍由此处的 Splitter 管理，把手放到实际头像上方，避免被误认为队列把手。
	const inputLayoutContext = {
		fillHeight: inputHeight.fillHeight,
		queueListMaxHeight: inputHeight.enabled ? inputHeight.queueListMaxHeight : undefined,
		// Lift the 12px grip so the three dots sit above shortcut chips, still inside card padding.
		inputResizeHandle: inputHeight.enabled ? (
			<ConversationInputResizeHandle
				positionClassName="-top-2.5"
				value={inputHeight.effectiveHeight}
				min={effectiveInputMinHeight}
				max={inputHeight.maxHeight}
				onResizeStart={inputHeight.startPointerResize}
				onResize={inputHeight.resizeByPointerDelta}
				onResizeEnd={inputHeight.finishPointerResize}
				onDoubleClick={inputHeight.restoreAutoHeight}
			/>
		) : null,
	}
	return (
		<div
			ref={layoutRef}
			className="min-h-0 w-full flex-1"
			data-testid="chat-project-message-layout"
		>
			{/* Keep the Ant bar hidden because the shared handle owns the visible resize interaction. */}
			<MagicSplitter
				layout="vertical"
				className="h-full min-h-0 w-full"
				onResize={NOOP_SPLITTER_RESIZE}
			>
				{/* 外层只承载受控尺寸；禁用透明拖动区，避免绕过队列和输入框各自的把手。 */}
				<MagicSplitter.Panel
					className={isConversationPanelCollapsed ? "invisible" : "min-h-0"}
					resizable={false}
				>
					{/* Keep the message fallback stretched so its flex centering uses the full panel height. */}
					<div className="flex h-full min-h-0 w-full flex-col">{messageList}</div>
				</MagicSplitter.Panel>
				<MagicSplitter.Panel
					min={effectiveInputMinHeight}
					size={inputHeight.effectiveHeight}
					max={inputHeight.maxHeight}
					className={isConversationPanelCollapsed ? "invisible" : "min-h-0"}
					resizable={false}
				>
					<div
						ref={inputRef}
						className={cn(
							"relative flex min-h-0 w-full items-end justify-center overflow-hidden",
							inputHeight.fillHeight && "h-full",
						)}
					>
						<ConversationInputLayoutProvider value={inputLayoutContext}>
							{input}
						</ConversationInputLayoutProvider>
					</div>
				</MagicSplitter.Panel>
			</MagicSplitter>
		</div>
	)
}
