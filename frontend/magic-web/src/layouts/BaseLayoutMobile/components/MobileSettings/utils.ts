import type { ComponentType } from "react"

export { getMobileSettingsPointsPurchaseState, groupPointsRecords } from "./pointsRecords"
import MobileSettingsOrderHistoryUnavailable from "./components/OrderHistoryUnavailable"

export interface MobileSettingsOrderHistoryPanelProps {
	embedded?: boolean
	onClose?: () => void
}

export interface MobileSettingsFeedbackUploadedImage {
	key: string
	uid: string
	name: string
}

export interface MobileSettingsFeedbackSubmitParams {
	type: string
	description: string
	contactEmail: string
	images: MobileSettingsFeedbackUploadedImage[]
}

/**
 * 购买入口默认回退给调用方自定义提示，避免共享层直接依赖具体实现。
 */
export function openMobileSettingsSubscriptionUpgrade(onUnavailable: () => void) {
	onUnavailable()
}

/**
 * 充值入口默认回退到占位提示，由调用方决定具体反馈。
 */
export function openMobileSettingsPointsRecharge(onUnavailable: () => void) {
	onUnavailable()
}

/**
 * 默认没有额外弹窗容器，保持共享 Sheet 的普通点击穿透策略。
 */
export function getMobileSettingsPaidPackageContainerId() {
	return null
}

/**
 * 订单记录内容默认回退到共享占位组件，由能力注入层决定是否替换。
 */
export async function loadMobileSettingsOrderHistoryPanel(): Promise<{
	default: ComponentType<MobileSettingsOrderHistoryPanelProps>
}> {
	return {
		default: MobileSettingsOrderHistoryUnavailable,
	}
}

export async function loadMobileSettingsPointsRecords(fallbackLabel: string) {
	void fallbackLabel
	return []
}

/**
 * 共享层默认不提供真实上传能力，企业覆盖层补齐后再启用图片上传。
 */
export async function uploadMobileSettingsFeedbackImages(files: File[]) {
	void files
	return [] as MobileSettingsFeedbackUploadedImage[]
}

/**
 * 共享层默认不提交反馈，避免开源基线误调用企业专属接口。
 */
export async function submitMobileSettingsFeedback(params: MobileSettingsFeedbackSubmitParams) {
	void params
	return false
}

