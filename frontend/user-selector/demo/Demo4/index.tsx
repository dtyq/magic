import {
	MobileUserSelector,
	OrganizationNode,
	Pagination,
	Resigned,
	SegmentType,
	SelectedPath,
	TreeNode,
} from "@dtyq/user-selector"
import {
	mockData,
	mockUsers,
	mockDepartments,
	mockUsers2,
	mockResigned,
	mockResigned2,
	organization,
} from "../const"
import "../../src/styles/variables.css"
import { useEffect, useMemo, useState } from "react"
import { useMemoizedFn } from "ahooks"

function Demo4({ visible, onClose }: { visible: boolean; onClose: () => void }) {
	const [data, setData] = useState<OrganizationNode[]>(() => [...mockDepartments, ...mockUsers])

	const [selectedValues, setSelectedValues] = useState<TreeNode[]>([])

	const [selectedPath, setSelectedPath] = useState<SelectedPath[]>([
		{ id: "dept_1", name: "技术部" },
	])

	const [loading, setLoading] = useState(false)
	const [searchData, setSearchData] = useState<Pagination<TreeNode>>({
		items: [],
		hasMore: false,
		loadMore: () => {},
	})

	const [resignedData, setResignedData] = useState<Pagination<Resigned>>({
		items: mockResigned,
		hasMore: true,
		loadMore: () => {},
	})

	const loadMoreResigned = useMemoizedFn(() => {
		setLoading(true)
		setTimeout(() => {
			const newData = [...resignedData.items, ...mockResigned2]
			setResignedData((prev) => ({
				...prev,
				items: newData,
				hasMore: false,
			}))
			setLoading(false)
		}, 1000)
	})

	useEffect(() => {
		setResignedData((prev) => ({
			...prev,
			loadMore: loadMoreResigned,
		}))
	}, [loadMoreResigned])

	const onItemClick = useMemoizedFn((node: TreeNode) => {
		setLoading(true)
		console.log(node)
		if (node.id === "dept_1") {
			setTimeout(() => {
				setLoading(true)
				setData(mockData)
				setLoading(false)
			}, 100)
		}
		setTimeout(() => {
			setLoading(false)
		}, 2000)
	})

	const handleSearchChange = (value: string, segmentType?: SegmentType | null) => {
		console.log(value)
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

	const handleBreadcrumbClick = (selectedPath: SelectedPath[]) => {
		setLoading(true)
		setSelectedPath(selectedPath)
		if (selectedPath.length === 0) {
			setData([...mockDepartments, ...mockUsers])
		} else if (selectedPath[selectedPath.length - 1].id === "dept_1") {
			setData(mockData)
		} else if (selectedPath[selectedPath.length - 1].id === "dept_3") {
			setData(mockUsers2)
		}
		setTimeout(() => {
			setLoading(false)
		}, 2000)
	}

	const handleSelectChange = (newValues: TreeNode[]) => {
		setSelectedValues(newValues)
	}

	const disabledValues = useMemo(() => [mockUsers[0], mockData[2]], [])

	return (
		<MobileUserSelector
			loading={loading}
			organization={organization}
			visible={visible}
			disabledValues={disabledValues}
			selectedValues={selectedValues}
			searchData={searchData}
			selectedPath={selectedPath}
			onClose={onClose}
			onMaskClick={onClose}
			onItemClick={onItemClick}
			onSelectChange={handleSelectChange}
			onSearchChange={handleSearchChange}
			onBreadcrumbClick={handleBreadcrumbClick}
			maxCount={1}
			data={data}
		/>
	)
}

export default Demo4
