import { useState } from "react"
import { MobileUserSelector, SegmentData, SegmentType, TreeNode } from "@/index"
import { organization, mockData } from "../const"
import "../../src/styles/variables.css"

function Demo6({ open, onClose }: { open: boolean; onClose: () => void }) {
	const [selectedValues, setSelectedValues] = useState<TreeNode[]>([])

	const handleSelectChange = (values: TreeNode[]) => {
		setSelectedValues(values)
	}

	const handleOk = (values: TreeNode[]) => {
		console.log("选中的值:", values)
		onClose()
	}

	// 分段数据配置
	const segmentData: SegmentData = {
		[SegmentType.ShareToMember]: mockData.slice(0, 10), // 分享至成员使用组织架构数据
	}

	// 获取设备安全区域信息
	const safeAreaBottom = "34"

	return (
		<MobileUserSelector
			organization={organization}
			visible={open}
			selectedValues={selectedValues}
			onClose={onClose}
			onMaskClick={onClose}
			onSelectChange={handleSelectChange}
			onOk={handleOk}
			data={mockData}
			segmentData={segmentData}
			// 安全区域配置
			safeAreaBottom={safeAreaBottom}
		/>
	)
}

export default Demo6
