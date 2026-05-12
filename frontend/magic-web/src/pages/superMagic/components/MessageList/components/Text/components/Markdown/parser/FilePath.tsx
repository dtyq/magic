import { observer } from "mobx-react-lite"
import projectFilesStore from "@/stores/projectFiles"
import { decodePathForDisplay, findAttachmentByPath } from "./helper"
import pubsub, { PubSubEvents } from "@/utils/pubsub"

export const FilePath = observer((props: { path?: unknown }) => {
	const { path } = props
	const normalizedPath = typeof path === "string" ? path : ""
	// 只解码展示文本，内部匹配和打开逻辑仍使用原始路径。
	const displayPath = decodePathForDisplay(normalizedPath)
	// 获取附件列表
	const attachments = projectFilesStore.workspaceFilesList

	// 根据相对路径查找文件信息
	const fileInfo = findAttachmentByPath(attachments, normalizedPath)

	const onClick = () => {
		if (fileInfo) {
			pubsub.publish(PubSubEvents.Open_File_Tab, {
				fileId: fileInfo?.file_id,
				fileData: fileInfo,
			})
		}
	}

	if (fileInfo) {
		// 找到文件，渲染可点击的文件标签
		return (
			<span
				className="cursor-pointer overflow-hidden whitespace-normal break-all rounded bg-[#f0f6ff] px-1.5 py-0.5 text-xs font-normal leading-5 text-[#315cec] hover:bg-[#e0ecff]"
				onClick={onClick}
				title={displayPath}
			>
				@{displayPath}
			</span>
		)
	}

	// 未找到文件，渲染为 disabled 状态的文件标签
	return (
		<span
			className="cursor-not-allowed overflow-hidden whitespace-normal break-all rounded bg-gray-100 px-1.5 py-0.5 text-xs font-normal leading-5 text-gray-500"
			title={`File does not exist @${displayPath}`}
		>
			@{displayPath}
		</span>
	)
})
