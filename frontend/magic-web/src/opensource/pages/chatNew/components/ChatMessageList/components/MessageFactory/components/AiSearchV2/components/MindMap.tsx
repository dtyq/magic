import MagicMarkmap from "@/opensource/components/base/MagicMarkmap"
import MagicMindMap from "@/opensource/components/base/MagicMindmap"
import type { AggregateAISearchCardMindMapChildren } from "@/types/chat/conversation_message"
import { Flex } from "antd"
import { memo } from "react"
import useStyles from "../styles"

interface MindMapProps {
	data?: AggregateAISearchCardMindMapChildren | string | null
	pptData?: string | null
	className?: string
}

/**
 * 检查内容是否包含一级标题及以上
 * @param content 内容
 * @returns 是否包含一级标题及以上
 */
const checkMarkmapContent = (content: string) => {
	// 只有包含一级标题及以上才认为true，使用正则匹配
	return /^(#+)\s/.test(content)
}

const MindMap = memo(({ data, pptData, className }: MindMapProps) => {
	const { styles, cx } = useStyles()

	if (typeof data === "string") {
		if (!data || !checkMarkmapContent(data)) return null

		return (
			<Flex vertical className={styles.mindmap}>
				<MagicMarkmap data={data} pptData={pptData} />
			</Flex>
		)
	}
	return (
		<Flex vertical className={cx(styles.mindmap, className)}>
			<MagicMindMap data-testid="mindmap" data={data} />
		</Flex>
	)
})

export default MindMap
