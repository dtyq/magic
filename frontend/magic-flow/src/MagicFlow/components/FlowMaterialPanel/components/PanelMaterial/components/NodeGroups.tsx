import React, { memo, useMemo } from "react"
import clsx from "clsx"
import { prefix } from "@/MagicFlow/constants"
import styles from "../index.module.less"
import NodeGroup from "./NodeGroup"
import VirtualNodeList from "./VirtualNodeList"

// 定义一个阈值，当节点数量超过这个阈值时启用虚拟滚动
const VIRTUAL_SCROLL_THRESHOLD = 30
const NODE_ITEM_HEIGHT = 40 // 估计的每个节点项的高度，需要根据实际UI调整

interface NodeGroupsProps {
	filterNodeGroups: any[]
	renderedNodeList: JSX.Element[]
	getGroupNodeList: any
	renderMaterialItem: (n: any, extraProps?: Record<string, any>) => JSX.Element | null
	MaterialItemFn: (props: Record<string, any>) => JSX.Element | null
}

const NodeGroups = memo(
	({
		filterNodeGroups,
		renderedNodeList,
		getGroupNodeList,
		renderMaterialItem,
		MaterialItemFn,
	}: NodeGroupsProps) => {
		// 判断是否需要使用虚拟滚动
		const shouldUseVirtualScroll = useMemo(() => {
			return renderedNodeList.length > VIRTUAL_SCROLL_THRESHOLD
		}, [renderedNodeList.length])

		if (filterNodeGroups?.length === 0) {
			// 如果节点数量超过阈值，使用虚拟滚动
			if (shouldUseVirtualScroll) {
				return <VirtualNodeList items={renderedNodeList} itemHeight={NODE_ITEM_HEIGHT} />
			}
			return <>{renderedNodeList}</>
		}

		// 渲染节点组
		const groupElements = filterNodeGroups.map((nodeGroup, i) => (
			<NodeGroup
				key={`group-${i}`}
				nodeGroup={nodeGroup}
				getGroupNodeList={getGroupNodeList}
				renderMaterialItem={renderMaterialItem}
				MaterialItemFn={MaterialItemFn}
			/>
		))

		return (
			<div className={clsx(styles.nodeGroups, `${prefix}node-groups`)}>{groupElements}</div>
		)
	},
	(prevProps, nextProps) => {
		// 深度比较可能不高效，这里仅比较引用，实际使用时可能需要自定义更合适的比较函数
		return (
			prevProps.filterNodeGroups === nextProps.filterNodeGroups &&
			prevProps.renderedNodeList === nextProps.renderedNodeList &&
			prevProps.renderMaterialItem === nextProps.renderMaterialItem &&
			prevProps.MaterialItemFn === nextProps.MaterialItemFn
		)
	},
)

export default NodeGroups
