import { observer } from "mobx-react-lite"
import { findAttachmentByPath } from "./helper"
import pubsub, { PubSubEvents } from "@/utils/pubsub"
import projectFilesStore from "@/stores/projectFiles"

export const Image = observer(({ alt, src }: { alt?: string; src?: string }) => {
	// 获取附件列表
	const attachments = projectFilesStore.workspaceFilesList

	// 如果没有 src，显示占位符
	if (!src) {
		return <span>![{alt || ""}]()</span>
	}

	// 根据相对路径查找文件信息
	const fileInfo = findAttachmentByPath(attachments, src)

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
				className="cursor-pointer overflow-hidden text-ellipsis whitespace-nowrap rounded bg-[#f0f6ff] px-1.5 py-0.5 text-xs font-normal leading-5 text-[#315cec] hover:bg-[#e0ecff]"
				onClick={onClick}
			>
				![{alt || fileInfo.file_name || fileInfo.filename}]({src})
			</span>
		)
	}

	// 未找到文件，返回原始语法
	return (
		<span>
			![{alt || ""}]({src})
		</span>
	)
})
