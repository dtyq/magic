import type { ImproveInformationData } from "@/components/business/ImproveInformationModal/types"

interface ImproveInformationPageCallbackStore {
	onSubmit?: (data: ImproveInformationData) => void | Promise<void>
	onSuccess?: () => void
	onClose?: () => void
}

/**
 * 移动端信息完善页面的回调存储
 * 在 showImproveInformationModal 跳转前写入，页面组件读取使用
 */
export const improveInformationPageCallbackStore: ImproveInformationPageCallbackStore = {}
