import { prefix } from "@/MagicFlow/constants"
import clsx from "clsx"
import React, { useCallback, useMemo, useRef } from "react"
import useMaterial from "./hooks/useMaterial"
import styles from "./index.module.less"
import NodeGroups from "./components/NodeGroups"

export interface PanelMaterialProps {
	keyword: string
	// 是否从端点出来的菜单栏
	isHoverMenu?: boolean
	// 由上层传入的Item项
	MaterialItemFn: (props: Record<string, any>) => JSX.Element | null
}

// 使用React.memo包装PanelMaterial组件，避免不必要的重新渲染
const PanelMaterial = React.memo(
	function PanelMaterial({ keyword, MaterialItemFn }: PanelMaterialProps) {
		const { nodeList, filterNodeGroups, getGroupNodeList } = useMaterial({ keyword })
		const containerRef = useRef<HTMLDivElement>(null)

		// 使用useCallback优化renderMaterialItem函数，避免不必要的重新创建
		const renderMaterialItem = useCallback(
			(n: any, extraProps: Record<string, any> = {}) => {
				// 使用解构赋值获取schema中的属性
				const { key, headerRight, ...restSchema } = n.schema
				// 创建一个固定的key，避免每次渲染生成新的字符串
				const itemKey = key || `item-${restSchema?.id}`

				// 直接返回MaterialItemFn组件，传递必要的props
				return <MaterialItemFn {...restSchema} {...extraProps} key={itemKey} />
			},
			[MaterialItemFn],
		)

		// 使用useMemo优化节点列表渲染，只在nodeList或MaterialItemFn变化时重新计算
		const renderedNodeList = useMemo(() => {
			return nodeList.map((n, i) => {
				const { key, headerRight, ...restSchema } = n.schema
				const itemKey = key || `item-${restSchema?.id}`
				return <MaterialItemFn {...restSchema} key={itemKey} />
			})
		}, [nodeList, MaterialItemFn])

		return (
			<div
				ref={containerRef}
				className={clsx(styles.panelMaterial, `${prefix}panel-material-list`)}
				onClick={(e) => e.stopPropagation()}
			>
				<NodeGroups
					filterNodeGroups={filterNodeGroups}
					renderedNodeList={renderedNodeList}
					getGroupNodeList={getGroupNodeList}
					renderMaterialItem={renderMaterialItem}
					MaterialItemFn={MaterialItemFn}
				/>
			</div>
		)
	},
	(prevProps, nextProps) => {
		// 只有keyword发生变化时才重新渲染
		return (
			prevProps.keyword === nextProps.keyword &&
			prevProps.MaterialItemFn === nextProps.MaterialItemFn
		)
	},
)

export default PanelMaterial
