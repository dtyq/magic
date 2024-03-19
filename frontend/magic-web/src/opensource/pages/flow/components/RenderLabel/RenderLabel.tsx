import { IconWindowMaximize } from "@tabler/icons-react"
import { Flex } from "antd"
import iconStyles from "@/opensource/pages/flow/nodes/VectorSearch/v0/components/KnowledgeSelect/KnowledgeSelect.module.less"
import type { ReactNode } from "react"
import { cx } from "antd-style"
import useStyles from "./style"

type RenderLabelProps = {
	name: ReactNode
	url?: string
	danger?: boolean
}

export default function RenderLabelCommon({ name, url, danger = false }: RenderLabelProps) {
	const { styles } = useStyles()
	return (
		<Flex align="center" gap={4}>
			<span
				className={cx({
					[styles.danger]: danger,
				})}
			>
				{name}
			</span>
			{!!name && !!url && (
				<IconWindowMaximize
					onClick={(e) => {
						e.stopPropagation()
						window.open(`${url}`, "_blank")
					}}
					className={iconStyles.iconWindowMaximize}
					size={20}
				/>
			)}
		</Flex>
	)
}
