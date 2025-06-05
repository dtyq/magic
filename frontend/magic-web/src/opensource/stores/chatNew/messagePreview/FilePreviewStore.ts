import { FilePreviewInfo } from "@/types/chat/preview"
import { makeAutoObservable } from "mobx"

/**
 * 文件预览 store
 */
class MessageFilePreviewStore {
	/**
	 * 预览信息
	 */
	previewInfo: FilePreviewInfo | undefined = undefined

	/**
	 * 预览窗口是否打开
	 */
	open: boolean = false

	constructor() {
		makeAutoObservable(this, {}, { autoBind: true })
	}

	/**
	 * 设置预览信息
	 * @param info 预览信息
	 */
	openPreview(info?: FilePreviewInfo) {
		if (info) {
			this.previewInfo = info
		}
		this.open = true
	}

	/**
	 * 清除预览信息
	 */
	clearPreviewInfo() {
		this.previewInfo = undefined
		this.open = false
	}
}

export default new MessageFilePreviewStore()
