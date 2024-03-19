import { useCurrentNode } from "@/MagicFlow/nodes/common/context/CurrentNode/useCurrentNode"
import DropdownCard from "@/common/BaseUI/DropdownCard"
import JSONSchemaRenderer from "@/common/BaseUI/JSONSchemaRenderer"
import clsx from "clsx"
import React from "react"
import styles from "./NodeOutputWrap.module.less"

type NodeOutputWrapProps = React.PropsWithChildren<{
	className?: string
}>

export default function NodeOutputWrap({ children, className }: NodeOutputWrapProps) {
	const { currentNode } = useCurrentNode()

	return (
		<div className={clsx(styles.nodeWrap, className)}>
			{children}
			<div className={styles.output}>
				<DropdownCard title="输出" height="auto">
					{/* @ts-ignore */}
					<JSONSchemaRenderer form={currentNode?.output?.form?.structure} />
				</DropdownCard>
			</div>
		</div>
	)
}
