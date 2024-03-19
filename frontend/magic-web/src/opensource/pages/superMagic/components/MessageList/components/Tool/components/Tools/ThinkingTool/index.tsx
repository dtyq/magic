import { memo, useMemo } from "react"
import ToolCard from "../../ToolCard"
import ToolContainer from "../../ToolContainer"
import type { BaseToolProps } from "../../../types"
import ThinkingContent from "./ThinkingContent"
import { useStyles } from "./styles"
import { useCollapse } from "../hooks/useCollapse"

interface ThinkingToolProps extends BaseToolProps {
	detail?: {
		type?: string
		data?: {
			content?: string
		}
	}
	remark: string
}

function ThinkingTool(props: ThinkingToolProps) {
	const { styles } = useStyles()
	const { expandedCardClassName } = useCollapse()
	const { showRemark, showToolDetail } = useMemo(() => {
		const hasContent = ((props.remark as string) || "")?.trim() !== ""
		return {
			showRemark: !hasContent,
			showToolDetail: hasContent,
		}
	}, [props.remark])

	return (
		<ToolContainer withDetail={showToolDetail} className={styles.container}>
			<ToolCard {...props} showRemark={showRemark} cardClassName={expandedCardClassName} />
			{showToolDetail && <ThinkingContent content={props.remark || ""} />}
		</ToolContainer>
	)
}

export default memo(ThinkingTool)
