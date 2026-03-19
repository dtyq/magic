import { memo } from "react"
import { Flex } from "antd"
import { useStyles } from "./styles"
import ThinkingQuoteLeft from "@/pages/superMagic/assets/tool_icon/thinking_quote_left.svg"
import ThinkingQuoteRight from "@/pages/superMagic/assets/tool_icon/thinking_quote_right.svg"
import EditorBody from "@/pages/superMagic/components/Detail/contents/Md/components/EditorBody"

function ThinkingContent({ content }: { content: string }) {
	const { styles } = useStyles()
	return (
		<Flex className={styles.thinkingContent} align="flex-start">
			<img
				src={ThinkingQuoteLeft}
				className={styles.quote}
				alt="quote"
				width={20}
				height={20}
			/>
			<EditorBody
				isLoading={false}
				viewMode="markdown"
				language="markdown"
				className={styles.editorBody}
				content={content}
			/>
			<img
				src={ThinkingQuoteRight}
				className={styles.quote}
				alt="quote"
				width={20}
				height={20}
			/>
		</Flex>
	)
}

export default memo(ThinkingContent)
