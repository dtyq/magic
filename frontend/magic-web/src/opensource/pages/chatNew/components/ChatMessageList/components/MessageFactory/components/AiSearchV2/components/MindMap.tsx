import type { AggregateAISearchCardMindMapChildren } from "@/opensource/types/chat/conversation_message"
import { Flex } from "antd"
import { lazy, memo, Suspense } from "react"
import useStyles from "../styles"

const MagicMindMap = lazy(() => import("@/opensource/components/base/MagicMindmap"))
const MagicMarkmap = lazy(() => import("@/opensource/components/base/MagicMarkmap"))

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
				<Suspense fallback={null}>
					<MagicMarkmap data={data} pptData={pptData} />
				</Suspense>
			</Flex>
		)
	}
	return (
		<Flex vertical className={cx(styles.mindmap, className)}>
			<Suspense fallback={null}>
				<MagicMindMap data-testid="mindmap" data={data} />
			</Suspense>
		</Flex>
	)
})

export default MindMap
