import { EmojiInfo } from "@/opensource/components/base/MagicEmojiPanel/types"
import { memo, useEffect, useRef } from "react"
import emojiJsons from "@/opensource/components/base/MagicEmojiPanel/emojis.json"
import EmojiSelect from "@/opensource/components/base/MagicEmojiPanel/components/EmojiSelect"
import { createStyles } from "antd-style"

const useStyles = createStyles(({ css, token }) => {
	return {
		emojiPanel: css`
			width: 100%;
			transition: height 0.3s ease-in-out;
			overflow-y: auto;
			background-color: ${token.colorBgContainer};
		`,
		emojiPanelContent: css`
			display: grid;
			grid-template-columns: repeat(8, 1fr);
			align-items: center;
			gap: 4px;
			padding: 0 10px;
			justify-content: center;
		`,
		emoji: css`
			width: 32px;
			height: 32px;
			display: flex;
			align-items: center;
			justify-content: center;
		`,
	}
})

interface EmojiPanelProps {
	open: boolean
	onAddEmoji: (emoji: EmojiInfo) => void
	onClose?: () => void
}

const EmojiPanel = memo(({ open, onAddEmoji, onClose }: EmojiPanelProps) => {
	const { styles } = useStyles()
	const emojiPanelRef = useRef<HTMLDivElement>(null)

	// Handle click outside to close emoji panel
	useEffect(() => {
		if (!open || !onClose) return

		const handleClickOutside = (event: MouseEvent) => {
			const target = event.target as Node
			if (emojiPanelRef.current && !emojiPanelRef.current.contains(target)) {
				onClose()
			}
		}

		// Add event listener with a small delay to avoid immediate closure
		const timeoutId = setTimeout(() => {
			document.addEventListener("mousedown", handleClickOutside)
		}, 100)

		return () => {
			clearTimeout(timeoutId)
			document.removeEventListener("mousedown", handleClickOutside)
		}
	}, [open, onClose])

	return (
		<div
			ref={emojiPanelRef}
			className={styles.emojiPanel}
			style={{ height: open ? "300px" : "0px" }}
		>
			<div className={styles.emojiPanelContent}>
				{emojiJsons.emojis.map((emoji) => {
					return (
						<EmojiSelect
							key={emoji.code}
							config={emoji}
							ns={emojiJsons.path}
							animatedNs={emojiJsons.animated_path}
							emojiClassName={styles.emoji}
							onEmojiClick={onAddEmoji}
						/>
					)
				})}
			</div>
		</div>
	)
})

export default EmojiPanel
