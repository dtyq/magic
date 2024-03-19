import type {
	Department,
	SelectedPath,
	TreeNode,
	Pagination,
	OrganizationNode,
} from "@dtyq/user-selector"
import { SegmentType, UserSelector } from "@dtyq/user-selector"
import { useMemoizedFn } from "ahooks"
import { useEffect, useState } from "react"
import { mockUsers, mockUsers2, mockResigned, organization, mulitLevelDepartments } from "../const"
import "../../src/styles/variables.css"
import { useResignData, useUserGroupData } from "./useResignData"

/** 从树中根据 id 查找节点并返回其 children */
function getChildrenByNodeId(list: OrganizationNode[], nodeId: string): OrganizationNode[] | null {
	for (const item of list) {
		if (item.id === nodeId) {
			return (item.children as Department[]) ?? []
		}
		const children = item.children as Department[] | undefined
		if (children?.length) {
			const found = getChildrenByNodeId(children, nodeId)
			if (found !== null) return found
		}
	}
	return null
}

/** 根据路径返回当前层应展示的 children */
function getChildrenByPath(list: OrganizationNode[], path: SelectedPath[]): OrganizationNode[] {
	if (path.length === 0) {
		return list
	}
	const targetId = path[path.length - 1].id
	return getChildrenByNodeId(list, targetId) ?? []
}

function Demo1({ open, onClose }: { open: boolean; onClose: () => void }) {
	const [data, setData] = useState<OrganizationNode[]>(() =>
		getChildrenByPath(mulitLevelDepartments, []),
	)

	const [searchData, setSearchData] = useState<Pagination<TreeNode>>({
		items: [],
		hasMore: false,
		loadMore: () => {},
	})

	const { memoizedResigned } = useResignData()
	const { memoizedUserGroup, updateUserGroupData } = useUserGroupData()

	const [loading, setLoading] = useState(false)
	const [selectedPath, setSelectedPath] = useState<SelectedPath[]>([])
	const [selectedValues, setSelectedValues] = useState<TreeNode[]>([])

	const onItemClick = useMemoizedFn((node: TreeNode, segmentType?: SegmentType) => {
		if (segmentType === SegmentType.UserGroup) {
			updateUserGroupData(node)
			return
		}

		const isSelected = selectedPath.findIndex((item) => item.id === node.id)
		if (isSelected !== -1) return

		setLoading(true)
		setSelectedPath((prev) => [...prev, { id: node.id, name: node.name }])
		const children = getChildrenByNodeId(mulitLevelDepartments, node.id) ?? []
		setData(children)
		setTimeout(() => setLoading(false), 100)
	})

	const handleSelectChange = (newValues: TreeNode[]) => {
		setSelectedValues(newValues)
	}

	const onOk = useMemoizedFn((nodes: TreeNode[]) => {
		console.log(nodes)
		console.log(nodes)
	})

	const loadMoreData = useMemoizedFn(() => {
		setLoading(true)
		setTimeout(() => {
			const newData = [...searchData.items, ...mockUsers]
			setSearchData((prev) => ({
				...prev,
				items: newData,
				hasMore: false,
			}))
			setLoading(false)
		}, 1000)
	})

	useEffect(() => {
		setSearchData((prev) => ({
			...prev,
			loadMore: loadMoreData,
		}))
	}, [loadMoreData])

	const handleSearchChange = (value: string, segmentType?: SegmentType | null) => {
		setLoading(true)
		if (!value) {
			setSearchData((prev) => ({
				...prev,
				items: [],
				hasMore: false,
			}))
			setLoading(false)
			return
		}
		if (segmentType === SegmentType.Resigned) {
			console.log(value, 129)
			setTimeout(() => {
				setSearchData((prev) => ({
					...prev,
					items: mockResigned.filter((item) => item.name.includes(value)),
					hasMore: false,
				}))
				setLoading(false)
			}, 2000)
		} else {
			setTimeout(() => {
				setSearchData((prev) => ({
					...prev,
					items: mockUsers,
					hasMore: false,
				}))
				setLoading(false)
			}, 2000)
		}
	}

	const handleBreadcrumbClick = useMemoizedFn((path: SelectedPath[]) => {
		setLoading(true)
		setSelectedPath(path)
		setData(getChildrenByPath(mulitLevelDepartments, path))
		setTimeout(() => setLoading(false), 100)
	})

	return (
		<UserSelector
			organization={organization}
			open={open}
			loading={loading}
			data={data}
			searchData={searchData}
			checkbox
			// disabledValues={disabledValues}
			selectedValues={selectedValues}
			// disableUser={true}
			// maxCount={2}
			onOk={onOk}
			// defaultSelectedPath={selectedPath}
			selectedPath={selectedPath}
			// 使用权限面板
			// useAuthPanel
			onCancel={onClose}
			onItemClick={onItemClick}
			onSelectChange={handleSelectChange}
			onSearchChange={handleSearchChange}
			onBreadcrumbClick={handleBreadcrumbClick}
			segmentData={{
				[SegmentType.Organization]: data,
				[SegmentType.Recent]: mockUsers2,
				[SegmentType.UserGroup]: memoizedUserGroup,
				[SegmentType.Resigned]: memoizedResigned,
			}}
		/>
	)
}

export default Demo1
