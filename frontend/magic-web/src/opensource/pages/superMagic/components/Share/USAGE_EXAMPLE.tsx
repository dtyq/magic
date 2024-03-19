/**
 * 分享功能使用示例
 * 这个文件展示了如何使用新的分享组件
 */

import { useState } from "react"
import MagicModal from "@/opensource/components/base/MagicModal"
import MagicButton from "@/opensource/components/base/MagicButton"
import ShareModal from "./Modal"
import FileShareModal from "./FileShareModal"
import { ShareType, ShareMode, ResourceType } from "./types"
import { SuperMagicApi } from "@/opensource/apis"
import { handleShareFunction } from "../../utils/share"

/**
 * 示例1: 话题分享（支持团队可访问）
 */
export function TopicShareExample() {
	const [visible, setVisible] = useState(false)

	return (
		<>
			<MagicButton onClick={() => setVisible(true)}>分享话题</MagicButton>

			<ShareModal
				open={visible}
				types={[ShareType.OnlySelf, ShareType.Organization, ShareType.Internet]}
				shareMode={ShareMode.Topic}
				shareContext={{
					resource_type: ResourceType.Topic,
					resource_id: "example-topic-id",
				}}
				afterSubmit={({ type, extraData }) => {
					console.log("话题分享设置:", { type, extraData })
					handleShareFunction({
						type,
						extraData,
						topicId: "example-topic-id",
						resourceType: ResourceType.Topic,
					})
					setVisible(false)
				}}
				onCancel={() => setVisible(false)}
			/>
		</>
	)
}

/**
 * 示例2: 文件分享（新功能）
 */
export function FileShareExample() {
	const [visible, setVisible] = useState(false)

	// 模拟文件列表数据
	const mockFileList = [
		{
			id: "file-1",
			name: "项目计划.docx",
			file_id: "file-1",
			is_directory: false,
			level: 0,
		},
		{
			id: "file-2",
			name: "设计稿",
			file_id: "folder-1",
			is_directory: true,
			level: 0,
		},
		{
			id: "file-3",
			name: "需求文档.pdf",
			file_id: "file-3",
			is_directory: false,
			level: 1,
		},
	]

	return (
		<>
			<MagicButton onClick={() => setVisible(true)}>分享文件</MagicButton>

			<MagicModal
				open={visible}
				width={800}
				title="分享文件"
				onCancel={() => setVisible(false)}
				footer={null}
			>
				<FileShareModal
					topicId="example-topic-id"
					attachments={mockFileList}
					types={[ShareType.OnlySelf, ShareType.Organization, ShareType.Internet]}
					onSubmit={async ({ type, extraData }) => {
						console.log("文件分享设置:", { type, extraData })

						const { fileIds, selectedFiles, ...settings } = extraData

						if (!fileIds || fileIds.length === 0) {
							console.warn("未选择文件")
							return
						}

						try {
							// 调用Mock API（后续需要替换为真实API）
							const result = await SuperMagicApi.createFileShare({
								topic_id: "example-topic-id",
								file_ids: fileIds,
								share_type: type,
								pwd: settings.passwordEnabled ? settings.password : undefined,
								allow_copy: settings.allowCopy,
								show_file_list: settings.showFileList,
								hide_creator_info: settings.hideCreatorInfo,
							})

							console.log("分享成功:", result)
							setVisible(false)
						} catch (error) {
							console.error("分享失败:", error)
						}
					}}
				/>
			</MagicModal>
		</>
	)
}

/**
 * 示例3: 在TopicFilesCore中集成（待实现）
 */
export function TopicFilesIntegrationExample() {
	// 在 useFileOperations.ts 中更新 handleShareItem
	const handleShareItemUpdated = (item: any, selectedItems?: Set<string>, allFiles?: any[]) => {
		if (selectedItems && selectedItems.size > 1) {
			// 多文件分享
			const selectedFileList = allFiles?.filter((f) => selectedItems.has(f.id)) || []
			// 打开FileShareModal并传递selectedFileList
			console.log("分享多个文件:", selectedFileList)
		} else if (item.is_directory) {
			// 文件夹分享
			console.log("分享文件夹:", item)
			// 打开FileShareModal
		} else {
			// 单文件分享
			console.log("分享单个文件:", item)
			// 打开FileShareModal
		}
	}

	return null // 这只是示例代码
}

/**
 * 示例4: VIP功能展示
 */
export function VIPFeatureExample() {
	// VIP功能在ShareTypeSelector中已自动处理
	// 非付费用户点击VIP功能时，会自动弹出套餐购买弹窗

	// 判断当前用户是否为付费用户
	// const isPaidUser = userStore.user.organizationSubscriptionInfo?.is_paid_plan

	// VIP功能包括：
	// 1. 访问密码
	// 2. 可查看文件列表
	// 3. 隐藏"由超级麦吉创造"字样

	return null
}
