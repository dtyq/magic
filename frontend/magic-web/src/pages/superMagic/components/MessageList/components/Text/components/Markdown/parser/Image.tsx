import { observer } from "mobx-react-lite"
import { decodePathForDisplay, findAttachmentByPath } from "./helper"
import pubsub, { PubSubEvents } from "@/utils/pubsub"
import projectFilesStore from "@/stores/projectFiles"

export const Image = observer(({ alt, src }: { alt?: unknown; src?: unknown }) => {
	const normalizedAlt = typeof alt === "string" ? alt : undefined
	const normalizedSrc = typeof src === "string" ? src : undefined
	// 获取附件列表
	const attachments = projectFilesStore.workspaceFilesList

	// 如果没有 src，显示占位符
	if (!normalizedSrc) {
		return <span>![{normalizedAlt || ""}]()</span>
	}

	// 根据相对路径查找文件信息
	const fileInfo = findAttachmentByPath(attachments, normalizedSrc)
	// 还原成中文路径
	const displaySrc = decodePathForDisplay(normalizedSrc)

	const onClick = () => {
		pubsub.publish(PubSubEvents.Open_File_Tab, {
			fileId: fileInfo?.file_id,
			fileData: fileInfo,
		})
	}

	// 如果找到文件信息，可以在这里进行进一步处理
	// 例如：获取临时下载链接、显示文件名等
	// 这里先显示原始的 markdown 语法
	if (fileInfo) {
		// 找到文件，可以返回文件的详细信息
		return (
			<span
				className="cursor-pointer overflow-hidden whitespace-normal break-all rounded bg-[#f0f6ff] px-1.5 py-0.5 text-xs font-normal leading-5 text-[#315cec] hover:bg-[#e0ecff]"
				onClick={onClick}
				title={displaySrc}
			>
				{/* markdown 图片命中附件时，统一按文件引用标签展示，保持和 file_path 一致。 */}@
				{displaySrc}
			</span>
		)
	}

	// markdown 图片未命中附件时，按文件引用的灰态展示，路径文案还原成中文。
	return (
		<span
			className="cursor-not-allowed overflow-hidden whitespace-normal break-all rounded bg-gray-100 px-1.5 py-0.5 text-xs font-normal leading-5 text-gray-500"
			title={`File does not exist @${displaySrc}`}
		>
			@{displaySrc}
		</span>
	)
})
