import { PREVIEW_EXTENSIONS } from "@/const/file"
import MessageFilePreviewStore from "@/opensource/stores/chatNew/messagePreview/FilePreviewStore"
import { ConversationMessageAttachment } from "@/types/chat/conversation_message"
import { FilePreviewInfo } from "@/types/chat/preview"

/**
 * 文件预览服务
 */
class MessageFilePreviewService {
	/**
	 * 设置预览信息
	 * @param info 预览信息
	 */
	openPreview(info?: FilePreviewInfo) {
		MessageFilePreviewStore.openPreview(info)
	}

	/**
	 * 清除预览信息
	 */
	clearPreviewInfo() {
		MessageFilePreviewStore.clearPreviewInfo()
	}

	/**
	 * 是否可以预览
	 * @param info 预览信息
	 * @returns 是否可以预览
	 */
	canPreview(info?: FilePreviewInfo | ConversationMessageAttachment) {
		if (!info) return false
		const ext = info.file_extension?.toLocaleLowerCase() ?? ""
		return PREVIEW_EXTENSIONS.includes(ext)
	}
}

export default new MessageFilePreviewService()
