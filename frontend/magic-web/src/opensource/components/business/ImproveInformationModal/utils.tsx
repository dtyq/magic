import { createRoot, type Root } from "react-dom/client"
import type { ImproveInformationData } from "./types"
import { lazy, Suspense } from "react"
import AppearanceProvider from "@/opensource/providers/AppearanceProvider"
import { interfaceStore } from "@/opensource/stores/interface"
import { history } from "@/opensource/routes/history"
import { RouteName } from "@/opensource/routes/constants"
import { improveInformationPageCallbackStore } from "@/opensource/stores/improve-information/store"

const ImproveInformationModal = lazy(() => import("./component"))

export const ImproveInformationModalContainerId = "improve-information-modal-container"

interface ShowImproveInformationModalOptions {
	/** 提交成功时的回调函数 */
	onSubmit?: (data: ImproveInformationData) => void | Promise<void>
	/** 弹窗关闭时的回调函数 */
	onClose?: () => void
}

let modalContainer: HTMLDivElement | null = null
let modalRoot: Root | null = null

/**
 * 动态显示完善信息弹窗（PC）或跳转到完善信息页面（移动端）
 * @param options 配置选项
 * @returns Promise，在弹窗关闭/页面返回时 resolve
 */
export function showImproveInformationModal(
	options: ShowImproveInformationModalOptions = {},
): Promise<ImproveInformationData | null> {
	return new Promise((resolve) => {
		// 移动端：跳转到独立页面
		if (interfaceStore.isMobile) {
			improveInformationPageCallbackStore.onSubmit = async (data) => {
				try {
					const res = await options.onSubmit?.(data)
					if (res) {
						resolve(res as ImproveInformationData)
					} else {
						resolve(data)
					}
				} catch (error) {
					console.error("Submit error in showImproveInformationModal:", error)
					resolve(data)
				}
			}

			improveInformationPageCallbackStore.onSuccess = () => {
				resolve(null)
			}

			improveInformationPageCallbackStore.onClose = () => {
				options.onClose?.()
				resolve(null)
			}

			history.replace({
				name: RouteName.ImproveInformation,
			})
			return
		}

		// PC 端：弹窗展示
		if (modalContainer && modalRoot) {
			closeModal()
		}

		modalContainer = document.createElement("div")
		modalContainer.id = ImproveInformationModalContainerId
		modalContainer.style.position = "relative"
		modalContainer.style.zIndex = "1000"
		document.body.appendChild(modalContainer)

		modalRoot = createRoot(modalContainer)

		const handleClose = () => {
			options.onClose?.()
			closeModal()
			resolve(null)
		}

		const handleSubmit = async (data: ImproveInformationData) => {
			try {
				const res = await options.onSubmit?.(data)
				if (res) {
					resolve(res as ImproveInformationData)
				} else {
					resolve(null)
				}
			} catch (error) {
				console.error("Submit error in showImproveInformationModal:", error)
				resolve(data)
			}
		}

		const ModalComponent = () => (
			<Suspense fallback={null}>
				<ImproveInformationModal
					open={true}
					onClose={handleClose}
					onSubmit={handleSubmit}
				/>
			</Suspense>
		)

		modalRoot.render(
			<AppearanceProvider>
				<ModalComponent />
			</AppearanceProvider>,
		)
	})
}

/**
 * 关闭并清理弹窗
 */
function closeModal() {
	if (modalRoot) {
		modalRoot.unmount()
		modalRoot = null
	}

	if (modalContainer) {
		document.body.removeChild(modalContainer)
		modalContainer = null
	}
}

/**
 * 检查当前是否有弹窗正在显示
 */
export function isImproveInformationModalOpen(): boolean {
	return modalContainer !== null && modalRoot !== null
}

/**
 * 强制关闭当前显示的弹窗
 */
export function forceCloseImproveInformationModal(): void {
	closeModal()
}
