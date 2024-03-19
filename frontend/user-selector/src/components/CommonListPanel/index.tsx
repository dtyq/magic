import { memo, type ReactElement, type ReactNode } from "react"
import InfiniteList from "../InfiniteList"
import { type TreeNode, type CheckboxOptions, NodeType } from "../UserSelector/types"
import { isDepartment, isMember, isUserGroup } from "@/utils"
import { useControllableValue, useMemoizedFn } from "ahooks"
import MemberItem from "./components/MemberItem"
import { useAppearance } from "@/context/AppearanceProvider"
import DepartmentItem from "./components/DepartmentItem"
import { Checkbox } from "@/components/ui/checkbox"
import { MobileCheckbox } from "@/components/ui/mobile-checkbox"
import { cn } from "@/lib/utils"
import { toast } from "sonner"

interface CommonListPanelProps<T> {
	/* 是否加载中 */
	loading?: boolean
	/* 是否还有更多数据 */
	hasMore?: boolean
	/* 已选/禁选 */
	checkboxOptions?: CheckboxOptions<TreeNode>
	/* 列表数据 */
	list?: T[]
	/* 最大可选人数 */
	maxCount?: number
	/* 是否是移动端 */
	isMobile?: boolean
	/* 列表为空时显示的内容 */
	emptyComponent?: ReactNode
	/* 是否禁选用户 */
	disableUser?: boolean
	/* 加载更多数据 */
	loadMore?: () => void
	/* 点击item */
	onItemClick?: (node: TreeNode) => void
}

const CommonListPanel = <T extends TreeNode>({
	list,
	loading = false,
	hasMore = false,
	checkboxOptions,
	maxCount = 0,
	isMobile = false,
	disableUser = false,
	emptyComponent,
	loadMore,
	onItemClick,
}: CommonListPanelProps<T>) => {
	const { getLocale } = useAppearance()
	const locale = getLocale()

	const [checkedList, setCheckedList] = useControllableValue<TreeNode[]>(checkboxOptions, {
		valuePropName: "checked",
		trigger: "onChange",
		defaultValue: [],
	})

	/* 是否禁用该节点 */
	const isDisabled = useMemoizedFn((node: TreeNode) => {
		const shouldDisabled = checkboxOptions?.disabled?.some((i) => i.id === node.id)
		if (disableUser && node.dataType === NodeType.User) {
			return true
		}
		if (maxCount > 0) {
			const isChecked = checkedList.some((i) => i.id === node.id)
			if (!isChecked) {
				return shouldDisabled || checkedList.length >= maxCount
			}
		}
		return shouldDisabled
	})

	/* 处理checkbox选中 */
	const handleCheck = useMemoizedFn((checked: boolean, item: T) => {
		if (isDisabled(item)) return
		if (checked) {
			if (maxCount > 0) {
				/* 如果没有禁选用户，且当前节点是部门，则需要判断员工数量是否大于最大可选人数 */
				if (item.dataType === NodeType.Department && !disableUser) {
					if (!item.employee_sum) {
						toast.error(locale.emptyEmployee)
						return
					}
					if (item.employee_sum > maxCount) {
						toast.error(locale.maxCountError)
						return
					}
				} else if (checkedList.length >= maxCount) {
					toast.error(locale.maxCountError)
					return
				}
			}
			setCheckedList([...checkedList, item])
		} else {
			setCheckedList(checkedList.filter((i) => i.id !== item.id))
		}
	})

	// 是否可以点击该节点
	const canNext = useMemoizedFn((node: TreeNode) => {
		return !checkedList.some((i) => i.id === node.id)
	})

	/* 点击item */
	const handleItemClick = useMemoizedFn((node: TreeNode) => {
		if (!node) return
		if (isDisabled(node)) return
		if ((isDepartment(node) || isUserGroup(node)) && canNext(node)) {
			onItemClick?.(node)
			return
		}
		if (checkedList.some((i) => i.id === node.id)) {
			// 如果当前节点已经选中，则取消选中
			setCheckedList(checkedList.filter((i) => i.id !== node.id))
		} else {
			setCheckedList([...checkedList, node])
		}
	})

	const renderItem = (item: T) => {
		const isChecked = checkedList?.some((c) => c.id === item.id)
		const disabled = isDisabled(item)

		return (
			<div
				className={cn(
					"flex w-full items-center gap-2 rounded-md cursor-pointer px-2 py-1.5 min-h-[44px]",
					"hover:bg-accent transition-colors",
					!isMobile && "px-2",
					isMobile && "pl-2",
				)}
			>
				{isMobile ? (
					<MobileCheckbox
						disabled={disabled}
						checked={isChecked}
						onCheckedChange={(checked) => handleCheck(checked === true, item)}
						className="shrink-0"
					/>
				) : (
					<Checkbox
						disabled={disabled}
						checked={isChecked}
						onCheckedChange={(checked) => {
							handleCheck(checked === true, item)
						}}
						className="shrink-0"
					/>
				)}
				<div className="h-full min-w-0 flex-1">
					{isMember(item) ? (
						<MemberItem data={item} onItemClick={handleItemClick} />
					) : (
						<DepartmentItem
							data={item}
							onItemClick={handleItemClick}
							showArrow={canNext(item)}
							isMobile={isMobile}
						/>
					)}
				</div>
			</div>
		)
	}

	return (
		<InfiniteList<T>
			isLoading={loading}
			list={list}
			hasMore={hasMore}
			emptyComponent={emptyComponent}
			loadMore={loadMore}
			renderItem={renderItem}
		/>
	)
}

export default memo(CommonListPanel) as <T extends TreeNode>(
	props: CommonListPanelProps<T>,
) => ReactElement
