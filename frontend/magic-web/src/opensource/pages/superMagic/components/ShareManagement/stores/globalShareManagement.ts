import { makeAutoObservable } from "mobx"
import { SharedResourceType } from "../types"

class GlobalShareManagementStore {
	visible = false
	projectId?: string
	defaultTab?: SharedResourceType

	constructor() {
		makeAutoObservable(this, {}, { autoBind: true })
	}

	/**
	 * 打开分享管理模态框
	 */
	open = (params?: { projectId?: string; defaultTab?: SharedResourceType }) => {
		this.projectId = params?.projectId
		this.defaultTab = params?.defaultTab
		this.visible = true
	}

	/**
	 * 关闭分享管理模态框
	 */
	close = () => {
		this.visible = false
		// 关闭后清理状态
		setTimeout(() => {
			this.projectId = undefined
			this.defaultTab = undefined
		}, 300) // 等待动画结束后清理
	}
}

const globalShareManagementStore = new GlobalShareManagementStore()

/**
 * 全局打开分享管理弹窗的函数
 */
export function openShareManagementModal(
	projectId?: string,
	options?: { defaultTab?: SharedResourceType },
) {
	globalShareManagementStore.open({
		projectId,
		defaultTab: options?.defaultTab,
	})
}

export default globalShareManagementStore
