import { WidgetValue } from "@/MagicFlow/examples/BaseFlow/common/Output"
import SourceHandle from "@/MagicFlow/nodes/common/Handle/Source"
import { useCurrentNode } from "@/MagicFlow/nodes/common/context/CurrentNode/useCurrentNode"
import DropdownCard from "@/common/BaseUI/DropdownCard"
import JSONSchemaRenderer from "@/common/BaseUI/JSONSchemaRenderer"
import { Flex } from "antd"
import clsx from "clsx"
import React, { ReactElement } from "react"
import styles from "./index.module.less"

type CommonProps = React.PropsWithChildren<{
	icon: ReactElement
	title: string
	template?: {
		trigger_type: number
		next_nodes: string[]
		config: Record<string, any> | null
		output: WidgetValue["value"]
	}
	branchId?: string
	showOutput?: boolean
	className?: string
	headerRight?: React.ReactNode
	style?: React.CSSProperties
}>

export default function Common({
	icon,
	title,
	template,
	branchId,
	children,
	showOutput = true,
	...props
}: CommonProps) {
	const { currentNode } = useCurrentNode()
	return (
		<div className={clsx(styles.startListItem, props?.className)} style={props?.style}>
			<SourceHandle
				type="source"
				isConnectable
				nodeId={currentNode?.node_id || ""}
				isSelected
				id={branchId}
			/>
			<div className={styles.header}>
				<Flex>
					<div className={styles.headerIcon}>{icon}</div>
					<span className={styles.title}>{title}</span>
				</Flex>
				<Flex>{props?.headerRight}</Flex>
			</div>
			{children && <div className={styles.body}>{children}</div>}
			{showOutput && (
				<DropdownCard title="输出">
					{/* @ts-ignore */}
					<JSONSchemaRenderer form={template?.output?.form?.structure} />
				</DropdownCard>
			)}
		</div>
	)
}
