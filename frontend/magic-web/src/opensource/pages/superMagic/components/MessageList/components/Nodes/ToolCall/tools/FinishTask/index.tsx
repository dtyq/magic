import type { NodeProps } from "../../../types"
import { useStyle } from "./styles"
import { Flex } from "antd"
import { memo } from "react"
import { observer } from "mobx-react-lite"
import { superMagicStore } from "@/opensource/pages/superMagic/stores"
import { ToolIconBadge } from "@/opensource/pages/superMagic/components/MessageList/components/shared/ToolIconConfig"

function FinishTask(props: NodeProps) {
	const { onMouseEnter, onMouseLeave } = props
	const node = superMagicStore.getMessageNode(props?.node?.app_message_id)
	const tool = node?.tool

	const { styles, cx } = useStyle()

	return (
		<div className={styles.node} onMouseEnter={onMouseEnter} onMouseLeave={onMouseLeave}>
			<div className={styles.container}>
				<Flex className={cx(styles.tag)}>
					<ToolIconBadge toolName={tool?.name} />
					<span className={cx(styles.tagLabel, "text-foreground")}>{tool?.action}</span>
				</Flex>
			</div>
		</div>
	)
}

export default memo(observer(FinishTask))
