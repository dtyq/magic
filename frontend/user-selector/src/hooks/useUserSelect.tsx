import { NodeType, SegmentData, SegmentType, TreeNode } from "@/components/UserSelector/types"
import { useAppearance } from "@/context/AppearanceProvider"
import { useMemo } from "react"
import {
	IconHeartHandshake,
	IconMessages,
	IconSitemap,
	IconUserOff,
	IconUsers,
	IconLink,
} from "@tabler/icons-react"
import { toast } from "sonner"

/**
 * 分段选择器选项
 * @param segmentData 分段数据
 * @param showIcon 是否显示图标
 * @returns
 */
const useSegment = (segmentData?: SegmentData, showIcon = true) => {
	const { getLocale } = useAppearance()
	const locale = getLocale()

	/** 分段选择器选项 */
	const DEFAULT_SEGMENT_OPTIONS = useMemo(
		() => [
			{
				label: locale.segment.organization,
				label2: locale.segment.organizationSelect,
				value: SegmentType.Organization,
				icon: showIcon ? <IconSitemap size={20} stroke={1.5} /> : null,
			},
			{
				label: locale.segment.recent,
				label2: locale.segment.recentSelect,
				value: SegmentType.Recent,
				icon: showIcon ? <IconUsers size={20} stroke={1.5} /> : null,
			},
			{
				label: locale.segment.group,
				label2: locale.segment.groupSelect,
				value: SegmentType.Group,
				icon: showIcon ? <IconMessages size={20} stroke={1.5} /> : null,
			},
			{
				label: locale.segment.userGroup,
				label2: locale.segment.userGroupSelect,
				value: SegmentType.UserGroup,
				icon: showIcon ? <IconUsers size={20} stroke={1.5} /> : null,
			},
			{
				label: locale.segment.partner,
				label2: locale.segment.partnerSelect,
				value: SegmentType.Partner,
				icon: showIcon ? <IconHeartHandshake size={20} stroke={1.5} /> : null,
			},
			{
				label: locale.segment.resigned,
				label2: locale.segment.resignedSelect,
				value: SegmentType.Resigned,
				icon: showIcon ? <IconUserOff size={20} stroke={1.5} /> : null,
			},
			{
				label: locale.segment.shareToGroup,
				label2: locale.segment.shareToGroup,
				value: SegmentType.ShareToGroup,
				icon: showIcon ? <IconLink size={20} stroke={1.5} /> : null,
			},
			{
				label: locale.segment.shareToMember,
				label2: locale.segment.shareToMember,
				value: SegmentType.ShareToMember,
				icon: showIcon ? <IconUsers size={20} stroke={1.5} /> : null,
			},
		],
		[locale, showIcon],
	)

	/** 分段选择器选项 */
	const SegmentOption = useMemo(() => {
		if (!segmentData) return []
		const selectedSegment = Object.keys(segmentData)
		return DEFAULT_SEGMENT_OPTIONS.filter((item) => selectedSegment.includes(item.value))
	}, [DEFAULT_SEGMENT_OPTIONS, segmentData])

	return {
		SegmentOption,
	}
}

/**
 * 选择器全选、禁用、选中项判断
 * @param data 数据
 * @param checkedList 已选中项
 * @param maxCount 最大可选人数
 * @param disabledValues 禁选项
 * @param setCheckedList 设置已选中项
 * @param disableUser 是否禁选用户
 * @returns
 */
export const useCheckSelect = (params: {
	data: TreeNode[]
	checkedList: TreeNode[]
	maxCount: number
	setCheckedList: (checkedList: TreeNode[]) => void
	disabledValues?: TreeNode[]
	disableUser?: boolean
}) => {
	const { data, checkedList, maxCount, setCheckedList, disabledValues, disableUser } = params

	const { getLocale } = useAppearance()
	const locale = getLocale()

	/* 是否禁用该节点 */
	const isDisabled = (node: TreeNode) => {
		const shouldDisabled = disabledValues?.some((i) => i.id === node.id)
		if (disableUser && node.dataType === NodeType.User) {
			return true
		}
		if (maxCount > 0) {
			return shouldDisabled || checkedList.length >= maxCount
		}
		return shouldDisabled
	}

	// 辅助函数：在限制范围内选择项目
	const selectItemsWithinLimit = (items: TreeNode[], limit: number) => {
		let employeeSum = 0
		const selectedItems: TreeNode[] = []

		for (const item of items) {
			if (employeeSum >= limit) break

			if (item.dataType === NodeType.Department) {
				/* 如果没有禁选用户，则需要判断员工数量是否大于最大可选人数 */
				if (!disableUser) {
					if (!item.employee_sum) continue

					if (employeeSum + item.employee_sum > limit) continue

					employeeSum += item.employee_sum
				} else {
					employeeSum += 1
				}

				selectedItems.push(item)
			} else {
				employeeSum += 1
				selectedItems.push(item)
			}
		}

		return selectedItems
	}

	/* 全选 */
	const handleCheckAll = (checked: boolean) => {
		if (checked) {
			const checkedMap = new Map()
			// 获取已选中项的Map
			checkedList.forEach((item) => checkedMap.set(`${item.dataType}-${item.id}`, item))

			// 过滤出未选中且未禁用的项
			const newItems = data.filter(
				(item) => !checkedMap.has(`${item.dataType}-${item.id}`) && !isDisabled(item),
			)

			/* 如果maxCount大于0，则需要判断是否超过最大可选人数 */
			if (maxCount > 0) {
				if (checkedList.length >= maxCount) {
					toast.error(locale.maxCountError)
					return
				}

				// 如果新项数量超过最大限制，需要特殊处理
				const selectedItems = selectItemsWithinLimit(newItems, maxCount)
				setCheckedList([...checkedList, ...selectedItems])
				return
			}

			if (newItems.length > 0) {
				setCheckedList([...checkedList, ...newItems])
			}
		} else {
			const dataArrayIds = new Set(data.map((item) => item.id))
			setCheckedList(checkedList.filter((c) => !dataArrayIds.has(c.id) || isDisabled(c)))
		}
	}

	const checkAll = useMemo(
		() => data.length > 0 && data.every((item) => checkedList.find((i) => i.id === item.id)),
		[data, checkedList],
	)

	const checkSome = useMemo(
		() => !checkAll && data.some((item) => checkedList.find((i) => i.id === item.id)),
		[checkAll, data, checkedList],
	)

	return {
		handleCheckAll,
		isDisabled,
		checkAll,
		checkSome,
	}
}

export default useSegment
