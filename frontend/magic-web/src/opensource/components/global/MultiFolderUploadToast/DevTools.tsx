import React from "react"
import { Button, Space, Card, Typography, Divider } from "antd"
import { observer } from "mobx-react-lite"
import {
	IconBug,
	IconTrash,
	IconPlayerPlay,
	IconWifiOff,
	IconWifi,
	IconRefresh,
} from "@tabler/icons-react"
import { multiFolderUploadStore } from "@/opensource/stores/folderUpload"

const { Text } = Typography

/**
 * 🧪 开发工具组件
 * 仅在开发环境中显示，用于测试MultiFolderUploadToast的各种状态
 */
export const FolderUploadDevTools: React.FC = observer(() => {
	// 只在开发环境显示
	if (process.env.NODE_ENV !== "development") {
		return null
	}

	const { hasActiveTasks, activeTasks, completedTasks, queueLength } = multiFolderUploadStore

	const handleStartMock = () => {
		multiFolderUploadStore.mockTasksForTesting()
	}

	const handleClearMock = () => {
		multiFolderUploadStore.clearMockTasks()
	}

	const handleSimulateOffline = () => {
		multiFolderUploadStore.simulateNetworkOffline()
	}

	const handleSimulateOnline = () => {
		multiFolderUploadStore.simulateNetworkOnline()
	}

	const handleResetNetwork = () => {
		multiFolderUploadStore.resetNetworkToReal()
	}

	return (
		<Card
			size="small"
			style={{
				position: "fixed",
				bottom: 20,
				right: 20,
				width: 340,
				zIndex: 1000,
				boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
			}}
			title={
				<Space>
					<IconBug size={16} />
					<span>📁 上传组件开发工具</span>
				</Space>
			}
		>
			<Space direction="vertical" style={{ width: "100%" }}>
				<div>
					<Text type="secondary">用于测试文件夹上传组件的各种状态</Text>
				</div>

				<Divider style={{ margin: "8px 0" }} />

				{/* 状态信息 */}
				<div>
					<Text strong>当前状态：</Text>
					<br />
					<Text type="secondary">• 活跃任务：{activeTasks.length}</Text>
					<br />
					<Text type="secondary">• 已完成任务：{completedTasks.length}</Text>
					<br />
					<Text type="secondary">• 队列任务：{queueLength}</Text>
					<br />
					<Text type="secondary">
						• 网络状态：
						<span style={{ color: navigator.onLine ? "#52c41a" : "#ff4d4f" }}>
							{navigator.onLine ? "🟢 在线" : "🔴 离线"}
						</span>
					</Text>
				</div>

				<Divider style={{ margin: "8px 0" }} />

				{/* Mock操作按钮 */}
				<div>
					<Text strong style={{ fontSize: "12px" }}>
						Mock 测试：
					</Text>
					<br />
					<Space wrap>
						<Button
							type="primary"
							size="small"
							icon={<IconPlayerPlay size={14} />}
							onClick={handleStartMock}
							disabled={hasActiveTasks}
						>
							启动Mock
						</Button>
						<Button
							size="small"
							icon={<IconTrash size={14} />}
							onClick={handleClearMock}
							disabled={!hasActiveTasks && completedTasks.length === 0}
						>
							清理数据
						</Button>
					</Space>
				</div>

				<Divider style={{ margin: "8px 0" }} />

				{/* 网络测试按钮 */}
				<div>
					<Text strong style={{ fontSize: "12px" }}>
						网络测试：
					</Text>
					<br />
					<Space wrap>
						<Button
							size="small"
							icon={<IconWifiOff size={14} />}
							onClick={handleSimulateOffline}
							danger
						>
							模拟断网
						</Button>
						<Button
							size="small"
							icon={<IconWifi size={14} />}
							onClick={handleSimulateOnline}
							style={{ color: "#52c41a", borderColor: "#52c41a" }}
						>
							模拟恢复
						</Button>
						<Button
							size="small"
							icon={<IconRefresh size={14} />}
							onClick={handleResetNetwork}
							type="dashed"
						>
							重置网络
						</Button>
					</Space>
				</div>

				{hasActiveTasks && (
					<Text type="warning" style={{ fontSize: "12px" }}>
						⚠️ 有活跃任务时不能启动新的Mock
					</Text>
				)}

				<Divider style={{ margin: "8px 0" }} />

				<div style={{ fontSize: "11px", color: "#999" }}>
					<Text type="secondary">
						Mock包含：1个上传中、2个已完成、3个等待中状态
						<br />
						网络测试可验证断网时自动暂停、恢复时继续上传
					</Text>
				</div>
			</Space>
		</Card>
	)
})

export default FolderUploadDevTools
