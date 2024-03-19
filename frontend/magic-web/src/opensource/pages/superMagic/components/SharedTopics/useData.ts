import { useEffect, useState } from "react"
import magicToast from "@/opensource/components/base/MagicToaster/utils"

export interface DataItem {
	id: string
	name: string
	size: number
	type: string
	uploadTime: string
	workspaceId: string
	workspaceName: string
	url: string
	topicId?: string
	topicName?: string
}

interface UseDataProps {
	searchKeywords?: string
}

export default ({ searchKeywords }: UseDataProps) => {
	const [data, setData] = useState<DataItem[]>([])

	const [loading, setLoading] = useState(false)

	const fetchData = async () => {
		setLoading(true)
		try {
			// 这里应该调用API获取标记的文件列表
			// 暂时使用模拟数据
			setTimeout(() => {
				// 基本文件类型和名称
				const fileTypes = ["md", "pdf", "docx", "txt"]
				const fileBaseNames = [
					"需求文档",
					"项目规划",
					"开发手册",
					"用户协议",
					"隐私条款",
					"会议纪要",
					"产品设计",
					"研发计划",
					"测试报告",
					"发布说明",
					"操作指南",
					"技术方案",
					"系统架构",
					"数据分析",
					"市场调研",
				]

				// 工作区名称
				const workspaces = [
					{ id: "ws1", name: "Magic项目" },
					{ id: "ws2", name: "团队项目" },
					{ id: "ws3", name: "个人项目" },
					{ id: "ws4", name: "研发中心" },
				]

				// 话题名称
				const topics = [
					{ id: "1", name: "话题 1" },
					{ id: "2", name: "话题 2" },
					{ id: "3", name: "话题 3" },
					{ id: "4", name: "话题 4" },
					{ id: "5", name: "话题 5" },
					{ id: "6", name: "话题 6" },
					{ id: "7", name: "话题 7" },
					{ id: "8", name: "话题 8" },
					{ id: "9", name: "话题 9" },
					{ id: "10", name: "话题 10" },
				]

				// 生成60条模拟数据
				const mockFiles: DataItem[] = []

				for (let i = 1; i <= 60; i += 1) {
					const fileType = fileTypes[Math.floor(Math.random() * fileTypes.length)]
					const baseName = fileBaseNames[Math.floor(Math.random() * fileBaseNames.length)]
					const workspace = workspaces[Math.floor(Math.random() * workspaces.length)]
					const topic = topics[Math.floor(Math.random() * topics.length)]

					// 生成随机大小 (5KB ~ 5MB)
					const size = Math.floor(Math.random() * (5 * 1024 * 1024 - 5 * 1024) + 5 * 1024)

					// 生成随机日期 (过去一年内)
					const date = new Date()
					date.setDate(date.getDate() - Math.floor(Math.random() * 365))
					const uploadTime = date.toISOString()

					mockFiles.push({
						id: i.toString(),
						name: `${baseName}_${i}.${fileType}`,
						size,
						type: fileType,
						uploadTime,
						workspaceId: workspace.id,
						workspaceName: workspace.name,
						url: "#",
						topicId: topic.id,
						topicName: topic.name,
					})
				}

				setData(mockFiles)
				setLoading(false)
			}, 500)
		} catch (error) {
			magicToast.error("获取标记文件列表失败")
			console.error("Failed to fetch starred files:", error)
			setLoading(false)
		}
	}

	useEffect(() => {
		fetchData()
	}, [])

	return {
		data,
		setData,
		loading,
	}
}
