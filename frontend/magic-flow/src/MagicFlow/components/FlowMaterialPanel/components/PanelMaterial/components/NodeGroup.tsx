import React, { memo, useCallback } from "react"
import clsx from "clsx"
import { prefix } from "@/MagicFlow/constants"
import styles from "../index.module.less"
import SubGroup from "./SubGroup/SubGroup"
import LazySubGroup from "./LazySubGroup"

interface NodeGroupProps {
	nodeGroup: any
	getGroupNodeList: any
	renderMaterialItem: (n: any, extraProps?: Record<string, any>) => JSX.Element | null
	MaterialItemFn: (props: Record<string, any>) => JSX.Element | null
}

const NodeGroup = memo(
	({ nodeGroup, getGroupNodeList, renderMaterialItem, MaterialItemFn }: NodeGroupProps) => {
		const shouldUseLazyLoad = useCallback((nodeGroup: any) => {
			return nodeGroup?.children && nodeGroup.children.length > 5
		}, [])

		return (
			<div className={clsx(styles.nodeGroup, `${prefix}node-group`)}>
				<div className={clsx(styles.groupName, `${prefix}group-name`)}>
					{nodeGroup?.groupName}
				</div>
				{!nodeGroup?.isGroupNode &&
					nodeGroup?.nodeSchemas?.map?.((n: any, i: number) => {
						const { key, ...restSchema } = n.schema
						return (
							<MaterialItemFn
								inGroup={false}
								{...restSchema}
								key={key || `schema-${i}`}
							/>
						)
					})}
				{nodeGroup?.isGroupNode &&
					nodeGroup?.children?.map((subGroup: any, subGroupIndex: number) => {
						const subGroupKey = `${subGroupIndex}-${subGroup.groupName}`
						return shouldUseLazyLoad(nodeGroup) ? (
							<LazySubGroup
								subGroup={subGroup}
								getGroupNodeList={getGroupNodeList}
								materialFn={renderMaterialItem}
								index={subGroupIndex}
								key={`lazy-sub-group-${subGroupKey}`}
							/>
						) : (
							<SubGroup
								subGroup={subGroup}
								getGroupNodeList={getGroupNodeList}
								key={`sub-group-${subGroupKey}`}
								materialFn={(n: any, extraProps: any) =>
									renderMaterialItem(n, {
										...extraProps,
										key: `item-${subGroupKey}-${n.schema?.id || 0}`,
									})
								}
							/>
						)
					})}
			</div>
		)
	},
	(prevProps, nextProps) => {
		// 对比nodeGroup是否发生了变化
		return (
			prevProps.nodeGroup === nextProps.nodeGroup &&
			prevProps.renderMaterialItem === nextProps.renderMaterialItem &&
			prevProps.MaterialItemFn === nextProps.MaterialItemFn
		)
	},
)

export default NodeGroup
