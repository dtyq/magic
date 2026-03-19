import { VoiceResultUtterance } from "@/components/business/VoiceInput/services/VoiceClient/types"
import { createStyles } from "antd-style"
import { Virtuoso, VirtuosoHandle } from "react-virtuoso"
import StreamLoading from "../StreamLoading"
import ScrollToBottom from "../ScrollToBottom"
import { forwardRef, useCallback, useEffect, useRef, useState } from "react"
import { useMemoizedFn } from "ahooks"
import { useTranslation } from "react-i18next"
import { formatTime } from "@/utils/string"

const useStyles = createStyles(({ token, css }) => ({
	messagesContainer: css`
		flex: 1;
		position: relative;
		height: 100%;

		/* Custom scrollbar */
		[data-testid="virtuoso-scroller"]::-webkit-scrollbar {
			width: 4px;
		}

		[data-testid="virtuoso-scroller"]::-webkit-scrollbar-track {
			background: transparent;
		}

		& [data-testid="virtuoso-scroller"]::-webkit-scrollbar-thumb {
			background: rgba(46, 47, 56, 0.13);
			border-radius: 100px;
		}
	`,
	messageItem: css`
		padding: 0 20px;
		margin: 10px 0;
		display: flex;
		flex-direction: column;
		gap: 8px;

		&.is-last {
			padding-bottom: 60px;
		}
	`,
	timestamp: css`
		color: ${token.magicColorUsages.text[2]};
		font-size: 12px;
		font-weight: 400;
		line-height: 16px;
	`,
	messageText: css`
		color: ${token.magicColorUsages.text[0]};
		font-size: 14px;
		font-weight: 400;
		line-height: 20px;
	`,
	streamLoading: css`
		transform: translateY(-1px);
		display: unset;
	`,
	emptyContainer: css`
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		height: 100%;
		padding: 20px;
		gap: 10px;
	`,
	emptyContent: css`
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 10px;
		border-radius: 12px;
	`,
	emptyWaveform: css`
		display: flex;
		gap: 2.8px;
		align-items: center;
		justify-content: center;
	`,
	emptyWaveformBar: css`
		width: 2.1px;
		border-radius: 1.4px;
		background: ${token.magicColorUsages.text[3]};
	`,
	emptyDescription: css`
		color: ${token.magicColorUsages.text[3]};
		font-size: 14px;
		font-weight: 400;
		line-height: 20px;
		text-align: justify;
	`,
	emptyHint: css`
		background: ${token.colorFillTertiary};
		padding: 4px 10px;
		border-radius: 8px;
		color: ${token.magicColorUsages.text[2]};
		font-size: 14px;
		font-weight: 400;
		line-height: 20px;
		text-align: justify;
	`,
}))

// Hook for handling virtuoso auto-scroll
function useVirtuosoAutoScroll({
	message,
	isExpanded,
}: {
	message: (VoiceResultUtterance & { add_time: number; id: string })[]
	isExpanded: boolean
}) {
	const virtuosoRef = useRef<VirtuosoHandle>(null)
	const [isAtBottom, setIsAtBottom] = useState(true)
	const isScrollProgrammatically = useRef<boolean>(false)
	const lastMessageRef = useRef<string>("")
	const lastMessageDefiniteRef = useRef<boolean>(false)

	const handleAtBottomStateChange = useCallback((atBottom: boolean) => {
		if (isScrollProgrammatically.current) return
		setIsAtBottom(atBottom)
	}, [])

	const scrollToBottom = useMemoizedFn(
		(force = false, behavior: "smooth" | "auto" = "smooth") => {
			if (!isExpanded || !virtuosoRef.current) return
			if (isAtBottom || force) {
				isScrollProgrammatically.current = true
				// Use scrollTo instead of scrollToIndex for more precise control
				virtuosoRef.current.scrollTo({
					top: 999999,
					behavior,
				})
				setIsAtBottom(true)
				// Reduce timeout delay for faster response
				setTimeout(() => {
					isScrollProgrammatically.current = false
				}, 100)
			}
		},
	)

	// Auto scroll when message changes and user is at bottom
	useEffect(() => {
		const validMessages = message.filter((item) => item.text)
		if (validMessages.length === 0) return

		const lastMessage = validMessages[validMessages.length - 1]
		const lastMessageKey = `${lastMessage.id}-${lastMessage.text?.substring(0, 50)}`

		// Update refs
		lastMessageRef.current = lastMessageKey
		lastMessageDefiniteRef.current = lastMessage.definite || false

		scrollToBottom(false, "smooth")
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [message.length, message[message.length - 1]?.text, message[message.length - 1]?.definite])

	return {
		virtuosoRef,
		isAtBottom,
		scrollToBottom,
		handleAtBottomStateChange,
	}
}

interface MessageListProps {
	message: (VoiceResultUtterance & { add_time: number; id: string })[]
	isExpanded: boolean
	className?: string
}

const MessageList = forwardRef<HTMLDivElement, MessageListProps>(function MessageList(
	{ message, isExpanded, className },
	ref,
) {
	const { styles, cx } = useStyles()
	const { t } = useTranslation("super")

	const { virtuosoRef, isAtBottom, scrollToBottom, handleAtBottomStateChange } =
		useVirtuosoAutoScroll({
			message,
			isExpanded,
		})

	// Filter out messages without text
	const validMessages = message.filter((item) => item.text)

	const itemContent = (index: number) => {
		const item = validMessages[index]
		const isLastMessage = index === validMessages.length - 1

		return (
			<div className={cx(styles.messageItem, { "is-last": isLastMessage })}>
				<div className={styles.timestamp}>
					{formatTime((item.add_time || Date.now()) / 1000, "HH:mm:ss")}
				</div>
				<div className={styles.messageText}>
					{item.text}
					{isLastMessage && !item.definite && (
						<StreamLoading size={20} className={styles.streamLoading} />
					)}
				</div>
			</div>
		)
	}

	if (validMessages.length === 0) {
		return (
			<div ref={ref} className={`${styles.messagesContainer} ${className || ""}`.trim()}>
				<div className={styles.emptyContainer}>
					<div className={styles.emptyContent}>
						<div className={styles.emptyWaveform}>
							<div className={styles.emptyWaveformBar} style={{ height: "7px" }} />
							<div className={styles.emptyWaveformBar} style={{ height: "14px" }} />
							<div className={styles.emptyWaveformBar} style={{ height: "7px" }} />
							<div className={styles.emptyWaveformBar} style={{ height: "14px" }} />
							<div className={styles.emptyWaveformBar} style={{ height: "8.4px" }} />
						</div>
						<div className={styles.emptyDescription}>
							{t("recordingSummary.ui.emptyState.description")}
						</div>
					</div>
					<div className={styles.emptyHint}>
						{t("recordingSummary.ui.emptyState.hint")}
					</div>
				</div>
			</div>
		)
	}

	return (
		<>
			<div ref={ref} className={`${styles.messagesContainer} ${className || ""}`.trim()}>
				<Virtuoso
					ref={virtuosoRef}
					totalCount={validMessages.length}
					itemContent={itemContent}
					atBottomStateChange={handleAtBottomStateChange}
					initialTopMostItemIndex={validMessages.length - 1}
					style={{ height: "100%", paddingBottom: 300 }}
					atBottomThreshold={200}
				/>
			</div>
			{!isAtBottom && <ScrollToBottom onClick={() => scrollToBottom(true)} />}
		</>
	)
})

export default MessageList
