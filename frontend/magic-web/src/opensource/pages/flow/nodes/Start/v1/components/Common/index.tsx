import type { WidgetValue } from "@dtyq/magic-flow/dist/MagicFlow/examples/BaseFlow/common/Output"
import SourceHandle from "@dtyq/magic-flow/dist/MagicFlow/nodes/common/Handle/Source"
import { useCurrentNode } from "@dtyq/magic-flow/dist/MagicFlow/nodes/common/context/CurrentNode/useCurrentNode"
import DropdownCard from "@dtyq/magic-flow/dist/common/BaseUI/DropdownCard"
import JSONSchemaRenderer from "@/opensource/pages/flow/components/JSONSchemaRenderer"
import { useMemo, type ReactElement, type ReactNode } from "react"
import type React from "react"
import { cx } from "antd-style"
import { Flex } from "antd"
import { useTranslation } from "react-i18next"
import styles from "./index.module.less"

type CommonProps = React.PropsWithChildren<{
	icon: ReactElement | null
	title: string | ReactNode
	template?: WidgetValue["value"]["form"]
	branchId?: string
	showOutput?: boolean
	className?: string
	headerRight?: React.ReactNode
	style?: React.CSSProperties
	outputWrapClassName?: string
	showHandle?: boolean
	defaultExpand?: boolean
	// 以下是 Flow 独有属性
}>

export default function Common({
	icon,
	title,
	template,
	branchId,
	children,
	showOutput = true,
	outputWrapClassName = "",
	showHandle = true,
	defaultExpand = true,
	...props
}: CommonProps) {
	const { t } = useTranslation()
	const { currentNode } = useCurrentNode()

	const hasBody = useMemo(() => {
		return !!children || !!template
	}, [children, template])

	return (
		<div className={cx(styles.startListItem, props?.className)} style={props?.style}>
			{showHandle && (
				<SourceHandle
					type="source"
					isConnectable
					nodeId={currentNode?.node_id || ""}
					isSelected
					id={branchId}
				/>
			)}
			<div
				className={cx(styles.header, {
					[styles.withoutBody]: !hasBody,
				})}
			>
				<Flex>
					{icon && <div className={styles.headerIcon}>{icon}</div>}
					<span className={styles.title}>{title}</span>
				</Flex>
				<Flex>{props?.headerRight}</Flex>
			</div>
			{hasBody && (
				<div className={cx(styles.outputWrap, outputWrapClassName)}>
					{children && <div className={styles.body}>{children}</div>}
					{template && showOutput && (
						<DropdownCard
							title={t("common.output", { ns: "flow" })}
							defaultExpand={defaultExpand}
						>
							{/* @ts-ignore */}
							<JSONSchemaRenderer form={template?.structure} />
						</DropdownCard>
					)}
				</div>
			)}
		</div>
	)
}
