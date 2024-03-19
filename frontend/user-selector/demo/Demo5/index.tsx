import { useState } from "react"
import UserSelector from "@/components/UserSelector"
import type { TreeNode, SegmentData } from "@/components/UserSelector/types"
import { SegmentType } from "@/components/UserSelector/types"
import { mockData, organization } from "../const"
import "../../src/styles/variables.css"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"

function Demo5({ open, onClose }: { open: boolean; onClose: () => void }) {
	const [selectedValues, setSelectedValues] = useState<TreeNode[]>([])

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
		[SegmentType.ShareToGroup]: shareToGroupData, // 分享至群聊使用自定义UI
		[SegmentType.ShareToMember]: mockData.slice(0, 10), // 分享至成员使用组织架构数据
	}

	// 为特定分段类型自定义右侧内容
	const renderRightBySegment = (_nodes: TreeNode[], segmentType?: SegmentType) => {
		switch (segmentType) {
			case SegmentType.ShareToGroup:
				return <div className="p-2 text-foreground">访问列表</div>
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

	return (
		<>
			<UserSelector
				organization={organization}
				open={open}
				title="分享选择器"
				data={mockData}
				segmentData={segmentData}
				selectedValues={selectedValues}
				onSelectChange={setSelectedValues}
				onOk={handleOk}
				onCancel={onClose}
				loading={false}
				disableUser={true}
				maxCount={1}
				renderRightBySegment={renderRightBySegment}
			/>
		</>
	)
}

export default Demo5
