import BreadCrumb from "../BreadCrumb"
import {
	Group,
	Partner,
	Resigned,
	SegmentData,
	SegmentType,
	SelectedPath,
	TreeNode,
	User,
	UserGroup,
} from "../../../UserSelector/types"
import { useControllableValue, useMemoizedFn } from "ahooks"
import { useMemo } from "react"
import CommonListPanel from "../../../CommonListPanel"
import { CommonOrganizationPanelProps } from "../../../OrganizationPanel"

export interface MobileListProps extends CommonOrganizationPanelProps {
	/* 分段类型 */
	segment?: SegmentType
	/* 分段数据 */
	segmentData?: SegmentData
	/* 更新分段类型 */
	updateSegment?: (segment: SegmentType | null) => void
}

const MobileList = ({
	data,
	organization,
	loading,
	segment,
	segmentData,
	checkboxOptions,
	maxCount,
	disableUser = false,
	pathOptions,
	updateSegment,
	onItemClick,
}: MobileListProps) => {
	const [selectedPath, setSelectedPath] = useControllableValue<SelectedPath[]>(pathOptions, {
		valuePropName: "checked",
		trigger: "onChange",
		defaultValue: [],
	})
	/** 面包屑点击事件 */
	const handleBreadcrumbClick = (index: number) => {
		const currentPath = selectedPath.slice(0, index + 1)
		if (index > -1) {
			setSelectedPath((prev) => prev.slice(0, index + 1))
		} else {
			setSelectedPath([])
			if (index === -2) {
				updateSegment?.(null)
			}
		}
		setSelectedPath(currentPath)
	}

	/* 更新选中路径 */
	const updateSelectedPath = useMemoizedFn((node: TreeNode) => {
		const isSelected = selectedPath.findIndex((item) => item.id === node.id)
		if (isSelected !== -1) return
		setSelectedPath((prev) => [...prev, { id: node.id, name: node.name }])
	})

	/* 点击item */
	const innerOnItemClick = useMemoizedFn((node: TreeNode) => {
		onItemClick?.(node, segment)
		updateSelectedPath(node)
	})

	const renderList = useMemo(() => {
		switch (segment) {
			case SegmentType.Recent:
			case SegmentType.Group:
			case SegmentType.Partner:
				return (
					<CommonListPanel<Group | Partner | User>
						loading={loading}
						list={segmentData?.[segment]}
						checkboxOptions={checkboxOptions}
						maxCount={maxCount}
						disableUser={disableUser}
						isMobile
					/>
				)
			case SegmentType.UserGroup:
			case SegmentType.Resigned:
				return (
					<CommonListPanel<Resigned | UserGroup>
						loading={loading}
						list={segmentData?.[segment]?.items}
						checkboxOptions={checkboxOptions}
						maxCount={maxCount}
						hasMore={segmentData?.[segment]?.hasMore}
						loadMore={segmentData?.[segment]?.loadMore}
						disableUser={disableUser}
						isMobile
						onItemClick={innerOnItemClick}
					/>
				)
			case SegmentType.ShareToGroup:
				return segmentData?.[segment] ?? null
			case SegmentType.Organization:
			default:
				return (
					<CommonListPanel<TreeNode>
						loading={loading}
						list={segmentData?.[SegmentType.Organization] ?? data}
						checkboxOptions={checkboxOptions}
						maxCount={maxCount}
						disableUser={disableUser}
						isMobile
						onItemClick={innerOnItemClick}
					/>
				)
		}
	}, [
		segment,
		loading,
		segmentData,
		checkboxOptions,
		maxCount,
		disableUser,
		data,
		innerOnItemClick,
	])

	return (
		<div className="h-[calc(100%-40px)]">
			<BreadCrumb
				segment={segment}
				organization={organization}
				selectedPath={selectedPath}
				onItemClick={handleBreadcrumbClick}
			/>
			{renderList}
		</div>
	)
}

export default MobileList
