import { useState } from "react"
import type { TreeNode, SegmentData, Pagination } from "@/components/UserSelector/types"
import { SegmentType } from "@/components/UserSelector/types"
import { mockData, mockResigned, mockUsers, organization } from "../const"
import "../../src/styles/variables.css"
import { MobileUserSelector } from "@/index"
import { Button } from "@/components/ui/button"
// import { message } from "@/hooks/use-toast"
import { toast } from "sonner"
// import { Toaster } from "@/components/ui/toaster"

function Demo7({ open, onClose }: { open: boolean; onClose: () => void }) {
	const [selectedValues, setSelectedValues] = useState<TreeNode[]>([])

	const [loading, setLoading] = useState(false)
	const [searchData, setSearchData] = useState<Pagination<TreeNode>>({
		items: [],
		hasMore: false,
		loadMore: () => {},
	})

	// 模拟分享至群聊的自定义UI数据
	const shareToGroupData = (
		<div style={{ padding: "20px" }}>
			<h3>分享至群聊</h3>
			<div style={{ marginBottom: "16px" }}>
				<p>选择要分享的群聊：</p>
				<div
					style={{
						border: "1px solid #d9d9d9",
						borderRadius: "6px",
						padding: "12px",
						marginBottom: "12px",
						cursor: "pointer",
						backgroundColor: "#fafafa",
					}}
				>
					<div style={{ fontWeight: "bold" }}>技术交流群</div>
					<div style={{ fontSize: "12px", color: "#666" }}>成员数: 128</div>
				</div>
				<div
					style={{
						border: "1px solid #d9d9d9",
						borderRadius: "6px",
						padding: "12px",
						marginBottom: "12px",
						cursor: "pointer",
						backgroundColor: "#fafafa",
					}}
				>
					<div style={{ fontWeight: "bold" }}>产品讨论群</div>
					<div style={{ fontSize: "12px", color: "#666" }}>成员数: 85</div>
				</div>
				<div
					style={{
						border: "1px solid #d9d9d9",
						borderRadius: "6px",
						padding: "12px",
						cursor: "pointer",
						backgroundColor: "#fafafa",
					}}
				>
					<div style={{ fontWeight: "bold" }}>项目管理群</div>
					<div style={{ fontSize: "12px", color: "#666" }}>成员数: 56</div>
				</div>
			</div>
			<div style={{ textAlign: "center" }}>
				<Button onClick={() => toast.success("分享成功！")}>确认分享</Button>
			</div>
		</div>
	)

	// 分段数据配置
	const segmentData: SegmentData = {
		[SegmentType.ShareToMember]: mockData.slice(0, 10), // 分享至成员使用组织架构数据
		[SegmentType.ShareToGroup]: shareToGroupData, // 分享至群聊使用自定义UI
	}

	// 为特定分段类型自定义右侧内容
	const renderRightBySegment = (_nodes: TreeNode[], segmentType?: SegmentType) => {
		switch (segmentType) {
			case SegmentType.ShareToGroup:
				return <div>访问列表</div>
			default:
				return null // 其他分段类型使用默认的SelectedPanel
		}
	}

	const handleOk = (values: TreeNode[]) => {
		console.log("选中的值:", values)
		setSelectedValues(values)
		onClose()
		toast.success(`已选择 ${values.length} 个成员`)
	}

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

	return (
		<>
			<MobileUserSelector
				organization={organization}
				visible={open}
				title="分享选择器"
				data={mockData}
				segmentData={segmentData}
				selectedValues={selectedValues}
				searchData={searchData}
				onSelectChange={setSelectedValues}
				onSearchChange={handleSearchChange}
				onOk={handleOk}
				onClose={onClose}
				loading={loading}
				maxCount={10}
				renderRightBySegment={renderRightBySegment}
			/>
		</>
	)
}

export default Demo7
