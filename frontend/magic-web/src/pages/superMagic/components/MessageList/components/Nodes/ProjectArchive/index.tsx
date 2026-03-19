import type { NodeProps } from "../types"
import { createStyles } from "antd-style"
import { Flex } from "antd"

const useStyle = createStyles(({ css }) => {
	return {
		node: css`
			width: 100%;
			height: fit-content;
			padding: 8px 8px 10px 8px;
			overflow: hidden;
			flex: none;
		`,
	}
})

export default function ProjectArchive(props: NodeProps) {
	const { node } = props

	const { styles } = useStyle()

	return <div className={styles.node}>{node?.content}</div>
}
