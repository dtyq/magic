import { memo } from "react"
import {
	type BaseProps,
	type Department,
	type Organization,
	type SelectedPath,
	type TreeNode,
	type CheckboxOptions,
	SegmentType,
} from "@/components/UserSelector/types"
import SelectorBreadcrumb from "@/components/OrganizationPanel/components/BreadCurmb"
import { useControllableValue, useMemoizedFn } from "ahooks"
import { cn } from "@/lib/utils"
import { useAppearance } from "@/context/AppearanceProvider"
import CommonListPanel from "../CommonListPanel"
import { useCheckSelect } from "@/hooks/useUserSelect"
import { Checkbox } from "@/components/ui/checkbox"
import { Empty } from "@/components/ui/empty"
import { IconUsers } from "@tabler/icons-react"

export interface CommonOrganizationPanelProps {
	/* 数据 */
	data: TreeNode[]
	/* 是否加载中 */
	loading?: boolean
	/* 组织信息 */
	organization?: Organization
	/** 已选/禁选 */
	checkboxOptions?: CheckboxOptions<TreeNode>
	/** 面包屑选中路径 */
	pathOptions?: CheckboxOptions<SelectedPath>
	/** 是否支持多选 */
	checkbox?: boolean
	/** 最大可选人数 */
	maxCount?: number
	/** 是否禁选用户 */
	disableUser?: boolean
	/** 选中路径变化事件 */
	onChangeSelectedPath?: (selectedPath: SelectedPath[]) => void
	/** 列表item点击事件 */
	onItemClick?: (node: TreeNode, segmentType?: SegmentType) => void
	/** 是否还有更多数据 */
	hasMore?: boolean
	/** 加载更多数据 */
	loadMore?: () => void
}

export type OrganizationPanelProps = CommonOrganizationPanelProps & BaseProps

function OrganizationPanel({
	data,
	loading,
	organization,
	checkbox = true,
	disableUser = false,
	className,
	style,
	checkboxOptions,
	maxCount = 0,
	onItemClick,
	pathOptions,
	hasMore,
	loadMore,
}: OrganizationPanelProps) {
	const { getLocale } = useAppearance()
	const locale = getLocale()

	const [selectedPath, setSelectedPath] = useControllableValue<SelectedPath[]>(pathOptions, {
		valuePropName: "checked",
		trigger: "onChange",
		defaultValue: [],
	})

	const [checkedList, setCheckedList] = useControllableValue<TreeNode[]>(checkboxOptions, {
		valuePropName: "checked",
		trigger: "onChange",
		defaultValue: [],
	})

	const { handleCheckAll, checkAll, checkSome } = useCheckSelect({
		data,
		checkedList,
		maxCount,
		disabledValues: checkboxOptions?.disabled,
		setCheckedList,
		disableUser,
	})

	/* 更新选中路径 */
	const updateSelectedPath = useMemoizedFn((node: Department) => {
		const isSelected = selectedPath.findIndex((item) => item.id === node.id)
		if (isSelected !== -1) return
		setSelectedPath((prev) => [...(prev || []), { id: node.id, name: node.name }])
	})

	/** 面包屑点击事件 */
	const handleBreadcrumbClick = (index: number) => {
		const currentPath = selectedPath.slice(0, index + 1)
		if (index > -1) {
			setSelectedPath((prev) => prev.slice(0, index + 1))
		} else {
			setSelectedPath([])
		}

		setSelectedPath(currentPath)
	}

	/* 点击item */
	const innerOnItemClick = useMemoizedFn((node: TreeNode) => {
		onItemClick?.(node)
		updateSelectedPath(node as Department)
	})

	return (
		<div className={cn("flex flex-col h-full overflow-y-hidden", className)} style={style}>
			<SelectorBreadcrumb
				organization={organization}
				selectedPath={selectedPath}
				onItemClick={handleBreadcrumbClick}
			/>
			<div className="mx-2 my-1.5 h-px bg-border" />
			{checkbox && data.length > 0 ? (
				<div
					className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 transition-colors hover:bg-accent"
					onClick={() => {
						if (data.length > 0) {
							handleCheckAll(!checkAll)
						}
					}}
				>
					<Checkbox
						checked={checkAll || checkSome ? "indeterminate" : false}
						onCheckedChange={(checked) => {
							handleCheckAll(checked === true)
						}}
						disabled={data.length === 0}
					/>
					<span className="text-sm font-medium text-foreground">{locale.selectAll}</span>
				</div>
			) : null}
			<CommonListPanel<TreeNode>
				loading={loading}
				list={data}
				checkboxOptions={checkboxOptions}
				maxCount={maxCount}
				disableUser={disableUser}
				hasMore={hasMore}
				loadMore={loadMore}
				onItemClick={innerOnItemClick}
				emptyComponent={
					<Empty
						image={<IconUsers size={24} />}
						description={locale.noDepartmentOrMember}
					/>
				}
			/>
		</div>
	)
}

export default memo(OrganizationPanel)
