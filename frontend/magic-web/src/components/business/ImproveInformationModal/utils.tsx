import { createRoot, type Root } from "react-dom/client"
import type { ImproveInformationData } from "./types"
import { lazy, Suspense } from "react"
import AppearanceProvider from "@/providers/AppearanceProvider"
import { interfaceStore } from "@/stores/interface"
import { baseHistory, history } from "@/routes/history"
import { RouteName } from "@/routes/constants"
import { RoutePathMobile } from "@/constants/routes"
import { improveInformationPageCallbackStore } from "@/stores/improve-information/store"
import {
	holdHomeOnboardingPrelude,
	releaseHomeOnboardingPrelude,
} from "@/pages/superMagic/components/LazyGuideTour/onboardingPrelude"

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
let activeModalPromise: Promise<ImproveInformationData | null> | null = null
let activeModalPlatform: "pc" | "mobile" | null = null
let resolveActiveModalPromise: ((value: ImproveInformationData | null) => void) | null = null

/**
 * 动态显示完善信息弹窗（PC）或跳转到完善信息页面（移动端）
 * @param options 配置选项
 * @returns Promise，在弹窗关闭/页面返回时 resolve
 */
export function showImproveInformationModal(
	options: ShowImproveInformationModalOptions = {},
): Promise<ImproveInformationData | null> {
	const currentPlatform = interfaceStore.isMobile ? "mobile" : "pc"

	if (activeModalPromise) {
		if (activeModalPlatform === currentPlatform) return activeModalPromise

		cleanupActiveModalCarrier(currentPlatform)
		resolveActiveModalPromise?.(null)
	}

	activeModalPlatform = currentPlatform

	activeModalPromise = new Promise((resolve) => {
		resolveActiveModalPromise = (value) => resolveModalPromise({ resolve, value })

		// 移动端：跳转到独立页面
		if (interfaceStore.isMobile) {
			improveInformationPageCallbackStore.onSubmit = async (data) => {
				try {
					const res = await options.onSubmit?.(data)
					if (res) {
						resolveActiveModalPromise?.(res as ImproveInformationData)
					} else {
						resolveActiveModalPromise?.(data)
					}
				} catch (error) {
					console.error("Submit error in showImproveInformationModal:", error)
					resolveActiveModalPromise?.(data)
				}
			}

			improveInformationPageCallbackStore.onSuccess = () => {
				resolveActiveModalPromise?.(null)
			}

			improveInformationPageCallbackStore.onClose = () => {
				options.onClose?.()
				resolveActiveModalPromise?.(null)
			}

			history.replace({
				name: RouteName.ImproveInformation,
			})
			return
		}

		// PC 端：弹窗展示
		if (modalContainer && modalRoot) return

		/*
		 * This dialog is the first thing a brand-new account is shown, and the new-user onboarding's
		 * own introduction is not allowed to land on top of it — so the feature that opens that
		 * introduction holds off for as long as this is on screen. Taken here, in the carrier the
		 * dialog is created and destroyed through, rather than at the call site: whoever shows this
		 * dialog gets the ordering with it, and there is one place to keep the two in step.
		 */
		holdHomeOnboardingPrelude("user-profile-dialog")

		modalContainer = document.createElement("div")
		modalContainer.id = ImproveInformationModalContainerId
		modalContainer.style.position = "relative"
		modalContainer.style.zIndex = "1001"
		document.body.appendChild(modalContainer)

		modalRoot = createRoot(modalContainer)

		const handleClose = () => {
			options.onClose?.()
			closeModal()
			resolveActiveModalPromise?.(null)
		}

		const handleSubmit = async (data: ImproveInformationData) => {
			try {
				const res = await options.onSubmit?.(data)
				if (res) {
					resolveActiveModalPromise?.(res as ImproveInformationData)
				} else {
					resolveActiveModalPromise?.(null)
				}
			} catch (error) {
				console.error("Submit error in showImproveInformationModal:", error)
				resolveActiveModalPromise?.(data)
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

	return activeModalPromise
}

/**
 * 关闭并清理弹窗
 */
function closeModal() {
	/*
	 * Every teardown of the dialog goes through here — submitted, force-closed, or replaced while the
	 * platform flips — so this is where the hold taken when it opened is given back. The onboarding
	 * behind it opens on the next render, and holding a dialog that is no longer on screen would keep
	 * it off for good.
	 */
	releaseHomeOnboardingPrelude("user-profile-dialog")

	if (modalRoot) {
		modalRoot.unmount()
		modalRoot = null
	}

	if (modalContainer?.parentNode) {
		modalContainer.parentNode.removeChild(modalContainer)
	}

	modalContainer = null
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
	resolveActiveModalPromise?.(null)
}

function cleanupActiveModalCarrier(nextPlatform: "pc" | "mobile") {
	if (activeModalPlatform === "pc") {
		closeModal()
		return
	}

	resetImproveInformationPageCallbacks()
	if (
		nextPlatform === "pc" &&
		baseHistory.location.pathname === RoutePathMobile.ImproveInformation
	) {
		history.replace({
			name: RouteName.Super,
		})
	}
}

function resolveModalPromise({
	resolve,
	value,
}: {
	resolve: (value: ImproveInformationData | null) => void
	value: ImproveInformationData | null
}) {
	resolve(value)
	resetImproveInformationPageCallbacks()
	activeModalPlatform = null
	activeModalPromise = null
	resolveActiveModalPromise = null
}

function resetImproveInformationPageCallbacks() {
	improveInformationPageCallbackStore.onSubmit = undefined
	improveInformationPageCallbackStore.onSuccess = undefined
	improveInformationPageCallbackStore.onClose = undefined
}
