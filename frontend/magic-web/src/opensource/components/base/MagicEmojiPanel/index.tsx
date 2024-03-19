import { createStyles } from "antd-style"
import { memo, useMemo, useState } from "react"
import { IconHeartFilled, IconMoodSmileFilled } from "@tabler/icons-react"
import { Flex } from "antd"
import { colorScales } from "@/opensource/providers/ThemeProvider/colors"
import MagicButton from "../MagicButton"
import MagicIcon from "../MagicIcon"

import emojiJsons from "./emojis.json"
import EmojiSelect from "./components/EmojiSelect"
import type { EmojiInfo } from "./types"

interface MagicEmojiPanelProps {
	style?: React.CSSProperties
	onClick?: (emoji: EmojiInfo) => void
}

const useStyles = createStyles(({ css, token }) => {
	return {
		panel: css`
			width: 600px;
			height: 292px;
			border-radius: 8px;
			overflow: hidden;
		`,
		emojis: css`
			overflow-y: auto;
			padding: 10px;
			height: 292px;

			::-webkit-scrollbar {
				width: 4px;
			}
		`,
		active: css`
			background-color: ${token.magicColorUsages.fill[0]};
		`,
		emoji: css`
			width: 48px;
			height: 48px;
			padding: 10px;
			border-radius: 8px;

			&:hover {
				background-color: ${token.magicColorUsages.fill[0]};
				cursor: pointer;
			}
		`,
		footer: css`
			width: 100%;
			height: 44px;
			border-top: 1px solid ${token.magicColorUsages.border};
			background: ${token.magicColorScales.grey[0]};
			padding: 6px 10px;
			border-radius: 0 0 8px 8px;
		`,
	}
})

const MagicEmojiPanel = memo(({ style, onClick }: MagicEmojiPanelProps) => {
	const { styles } = useStyles()

	const [panelKey, setPanelKey] = useState<"emoji" | "like">("emoji")

	const emojiList = useMemo(
		() =>
			emojiJsons.emojis.map((emoji) => {
				return (
					<EmojiSelect
						key={emoji.code}
						config={emoji}
						ns={emojiJsons.path}
						animatedNs={emojiJsons.animated_path}
						emojiClassName={styles.emoji}
						onEmojiClick={onClick}
					/>
				)
			}),
		[onClick, styles.emoji],
	)

	return (
		<Flex vertical justify="flex-end" className={styles.panel} style={style}>
			<Flex className={styles.emojis} wrap="wrap" flex={1}>
				{panelKey === "emoji" ? emojiList : null}
			</Flex>
			<Flex className={styles.footer} gap={10}>
				<MagicButton
					type="text"
					className={panelKey === "emoji" ? styles.active : ""}
					onClick={() => setPanelKey("emoji")}
					icon={
						<MagicIcon
							size={20}
							component={IconMoodSmileFilled}
							color={colorScales.yellow[5]}
						/>
					}
				/>
				<MagicButton
					type="text"
					className={panelKey === "like" ? styles.active : ""}
					onClick={() => setPanelKey("like")}
					icon={
						<MagicIcon
							size={20}
							component={IconHeartFilled}
							color={colorScales.red[5]}
						/>
					}
				/>
			</Flex>
		</Flex>
	)
})

export default MagicEmojiPanel
