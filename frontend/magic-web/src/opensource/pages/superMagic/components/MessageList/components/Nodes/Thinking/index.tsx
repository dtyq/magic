import type { NodeProps } from "../types"
import { createStyles } from "antd-style"
import Text from "@/opensource/pages/superMagic/components/MessageList/components/Text"
import { superMagicStore } from "@/opensource/pages/superMagic/stores"
import { memo } from "react"
import { observer } from "mobx-react-lite"

const useStyle = createStyles(({ css }) => {
	return {
		node: css`
			width: 100%;
			height: fit-content;
			padding: 5px 8px 5px 8px;
			overflow: hidden;
			flex: none;
		`,
	}
})

function Thinking(props: NodeProps) {
	const node = superMagicStore.getMessageNode(props?.node?.app_message_id)

	const { styles, cx } = useStyle()

	if (!node?.content) {
		return null
	}
	return (
		<div className={cx(styles.node)}>
			<Text data={node} isUser={false} hideHeader onSelectDetail={() => {}} />
		</div>
	)
}

export default memo(observer(Thinking))
