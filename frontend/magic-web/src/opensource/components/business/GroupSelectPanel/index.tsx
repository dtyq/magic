import MagicInfiniteScrollList from "@/opensource/components/MagicInfiniteScrollList"
import type { MagicListItemData } from "@/opensource/components/MagicList/types"
import { contactStore } from "@/opensource/stores/contact"
import type { GroupConversationDetailWithConversationId } from "@/types/chat/conversation"
import { StructureItemType } from "@/types/organization"
import { useControllableValue } from "ahooks"
import { useMemo, useState, useEffect, useCallback } from "react"
import type { OrganizationSelectItem } from "../MemberDepartmentSelectPanel/types"
import { observer } from "mobx-react-lite"

type GroupSelectItem = OrganizationSelectItem & MagicListItemData

const itemsTransform = (item: GroupConversationDetailWithConversationId): GroupSelectItem => ({
	...item,
	dataType: StructureItemType.Group,
	title: item.group_name,
	avatar: item.group_avatar || {
		children: item.group_name,
	},
})

interface GroupSelectPanelProps {
	value: OrganizationSelectItem[]
	onChange: (value: OrganizationSelectItem[]) => void
	className?: string
	style?: React.CSSProperties
}

/**
 * 群组选择面板
 */
const GroupSelectPanel = observer((props: GroupSelectPanelProps) => {
	// 使用状态管理数据和加载状态
	const [data, setData] = useState<any>(undefined)

	// 使用useCallback定义获取数据的方法
	const fetchData = useCallback(async (params = {}) => {
		const result = await contactStore.getUserGroups(params)
		setData(result)
		return result
	}, [])

	// 初始加载
	useEffect(() => {
		fetchData()
	}, [fetchData])

	const [value, setValue] = useControllableValue<GroupSelectItem[]>(props, {
		defaultValue: [],
	})

	const checkboxOptions = useMemo(
		() => ({
			checked: value,
			onChange: setValue,
			dataType: StructureItemType.Group,
		}),
		[setValue, value],
	)

	return (
		<MagicInfiniteScrollList<GroupConversationDetailWithConversationId, GroupSelectItem>
			data={data}
			trigger={fetchData}
			itemsTransform={itemsTransform}
			checkboxOptions={checkboxOptions}
			className={props.className}
			style={props.style}
			noDataFallback={<div />}
		/>
	)
})

export default GroupSelectPanel
