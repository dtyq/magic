import type { SelectedPath, TreeNode, Pagination, OrganizationNode } from "@dtyq/user-selector"
import { UserSelector } from "@dtyq/user-selector"
import { useMemoizedFn } from "ahooks"
import { useMemo, useState } from "react"
import { mockData, mockUsers, mockDepartments, mockUsers2 } from "../const"
import "../../src/styles/variables.css"

function Demo2({ open, onClose }: { open: boolean; onClose: () => void }) {
	const [data, setData] = useState<OrganizationNode[]>(() => [...mockDepartments, ...mockUsers])
	const [searchData, setSearchData] = useState<Pagination<TreeNode>>({
		items: [],
		hasMore: false,
		loadMore: () => { },
	})
	const [loading, setLoading] = useState(false)

	const onItemClick = useMemoizedFn((node: TreeNode) => {
		if (node.id === "dept_3") {
			setTimeout(() => {
				setLoading(true)
				setData(mockUsers2)
				setLoading(false)
			}, 100)
		}
		if (node.id === "dept_1") {
			setTimeout(() => {
				setLoading(true)
				setData(mockData)
				setLoading(false)
			}, 100)
		}
		if (node.id === "dept_2") {
			setTimeout(() => {
				setLoading(true)
				setData([])
				setLoading(false)
			}, 100)
		}
	})

	const disabledValues = useMemo(() => [mockUsers[0], mockUsers[1], mockUsers[2]], [])

	const [selectedValues, setSelectedValues] = useState<TreeNode[]>([mockUsers[1], mockUsers[0]])

	const handleSelectChange = (newValues: TreeNode[]) => {
		setSelectedValues(newValues)
	}

	const onOk = useMemoizedFn((nodes: TreeNode[]) => {
		console.log(nodes)
		onClose()
	})

	const handleSearchChange = (value: string) => {
		console.log(value)
		if (value) {
			setLoading(true)
			setTimeout(() => {
				setSearchData({
					items: mockUsers,
					hasMore: false,
					loadMore: () => { },
				})
				setLoading(false)
			}, 500)
		} else {
			setSearchData({
				items: [],
				hasMore: false,
				loadMore: () => { },
			})
			setLoading(false)
		}
	}

	const handleBreadcrumbClick = (selectedPath: SelectedPath[]) => {
		console.log(selectedPath, 444)
		if (selectedPath.length === 0) {
			setData([...mockDepartments, ...mockUsers])
		} else if (selectedPath[selectedPath.length - 1].id === "dept_1") {
			setData(mockData)
		} else if (selectedPath[selectedPath.length - 1].id === "dept_3") {
			setData(mockUsers2)
		}
	}

	return (
		<UserSelector
			organization={{
				id: "Xcxcx",
				name: "灯塔引擎",
				logo: "https://texample.com/588417215791890433/bb1902a4_1735635442151.png",
			}}
			open={open}
			loading={loading}
			data={data}
			searchData={searchData}
			checkbox
			disabledValues={disabledValues}
			selectedValues={selectedValues}
			useAuthPanel
			onOk={onOk}
			onCancel={onClose}
			onItemClick={onItemClick}
			onSelectChange={handleSelectChange}
			onSearchChange={handleSearchChange}
			onBreadcrumbClick={handleBreadcrumbClick}
		/>
	)
}

export default Demo2
