import { prefix } from "@/MagicFlow/constants"
import { MaterialGroup } from "@/MagicFlow/context/MaterialSourceContext/MaterialSourceContext"
import { BaseNodeType, NodeGroup, NodeWidget } from "@/MagicFlow/register/node"
import { Collapse, Tooltip } from "antd"
import { IconChevronDown, IconHelp } from "@tabler/icons-react"
import clsx from "clsx"
import React, { ReactNode, useMemo, useCallback, useState } from "react"
import useAvatar from "../../MaterialItem/hooks/useAvatar"
import styles from "./SubGroup.module.less"

const { Panel } = Collapse

type SubGroupProps = {
	subGroup: NodeGroup | MaterialGroup
	getGroupNodeList: (nodeTypes: BaseNodeType[]) => NodeWidget[]
	materialFn: (n: NodeWidget, extraProps: Record<string, any>) => ReactNode
}

// 单独提取渲染项组件，并使用memo优化它
const SubGroupItem = React.memo(
	({
		node,
		index,
		renderItem,
	}: {
		node: NodeWidget
		index: number
		renderItem: (n: NodeWidget, i: number) => ReactNode
	}) => {
		return <>{renderItem(node, index)}</>
	},
	(prevProps, nextProps) => {
		// 只比较关键属性，避免不必要的渲染
		return (
			prevProps.node.schema.id === nextProps.node.schema.id &&
			prevProps.index === nextProps.index
		)
	},
)

function SubGroup({ subGroup, getGroupNodeList, materialFn }: SubGroupProps) {
	const { AvatarComponent } = useAvatar({
		icon: subGroup?.icon || "",
		color: subGroup?.color || "",
		avatar: subGroup.avatar,
		showIcon: true,
	})

	// 追踪子面板的展开状态
	const [activeKey, setActiveKey] = useState<string | undefined>(undefined)
	const [isRendered, setIsRendered] = useState(false)
	// 缓存节点列表，避免每次展开都重新获取
	const [cachedNodeList, setCachedNodeList] = useState<NodeWidget[]>([])

	const SubGroupHeader = useMemo(() => {
		return (
			<>
				{AvatarComponent}
				<span className={clsx(styles.title, `${prefix}title`)}>{subGroup.groupName}</span>
				{subGroup.desc && (
					<Tooltip title={subGroup.desc}>
						<IconHelp
							color="#1C1D2359"
							size={22}
							className={clsx(styles.help, `${prefix}help`)}
						/>
					</Tooltip>
				)}
			</>
		)
	}, [AvatarComponent, subGroup.groupName, subGroup.desc])

	// 优化：使用useCallback包装renderItem以避免不必要的重新创建
	const renderItem = useCallback(
		(n: NodeWidget, i: number) => {
			return materialFn(n, {
				key: i,
				showIcon: false,
				inGroup: true,
			})
		},
		[materialFn],
	)

	// 处理折叠面板变更
	const handleCollapseChange = useCallback(
		(key: string | string[]) => {
			const isActive =
				key &&
				(Array.isArray(key)
					? key.includes(subGroup.groupName!)
					: key === subGroup.groupName)
			setActiveKey(isActive ? subGroup.groupName : undefined)

			// 如果是首次展开，则标记为已渲染并加载节点数据
			if (isActive && !isRendered) {
				setIsRendered(true)
				const nodeTypes = (subGroup as NodeGroup)?.nodeTypes || []
				setCachedNodeList(getGroupNodeList(nodeTypes))
			}
		},
		[subGroup.groupName, isRendered, getGroupNodeList, subGroup],
	)

	// 渲染子项列表，只有在面板展开且已加载数据时才渲染
	const renderedItems = useMemo(() => {
		if (!isRendered || cachedNodeList.length === 0) {
			return null
		}

		return cachedNodeList.map((node, index) => (
			<SubGroupItem
				key={`${subGroup.groupName}-item-${index}-${node.schema?.id || index}`}
				node={node}
				index={index}
				renderItem={renderItem}
			/>
		))
	}, [isRendered, cachedNodeList, renderItem, subGroup.groupName])

	return (
		<div className={clsx(styles.subGroup, `${prefix}sub-group`)}>
			<Collapse
				expandIcon={() => <IconChevronDown color="#1C1D2399" size={20} />}
				activeKey={activeKey}
				onChange={handleCollapseChange}
			>
				<Panel header={SubGroupHeader} key={subGroup.groupName!}>
					{renderedItems}
				</Panel>
			</Collapse>
		</div>
	)
}

// 使用React.memo包装组件并添加自定义比较函数
export default React.memo(SubGroup, (prevProps, nextProps) => {
	// 只比较关键属性，减少不必要的重新渲染
	return (
		prevProps.subGroup.groupName === nextProps.subGroup.groupName &&
		prevProps.materialFn === nextProps.materialFn &&
		prevProps.getGroupNodeList === nextProps.getGroupNodeList
	)
})
