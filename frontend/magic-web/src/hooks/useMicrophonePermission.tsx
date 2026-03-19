import { useCallback } from "react"
import { Modal } from "antd"
import { Dialog } from "antd-mobile"
import { useIsMobile } from "@/hooks/useIsMobile"
import { useMicrophonePermissionI18n } from "@/hooks/useMicrophonePermissionI18n"
import { MicrophonePermissionService } from "@/services/MicrophonePermissionService"
import { isIosMagicApp } from "@/utils/devices"
import magicToast from "@/components/base/MagicToaster/utils"

interface UseMicrophonePermissionOptions {
	onStateReset?: () => void // 状态重置回调，在显示权限弹窗时立即调用
}

/**
 * 通用麦克风权限处理hook
 * 支持桌面端(Modal)和移动端(Dialog)的权限引导
 */
export function useMicrophonePermission(options?: UseMicrophonePermissionOptions) {
	const { onStateReset } = options || {}
	const isMobile = useIsMobile()
	const { permissionModal, permissionInstructions } = useMicrophonePermissionI18n()

	/**
	 * 处理麦克风权限被拒绝的情况
	 * 根据平台显示相应的权限设置引导弹窗
	 */
	const handlePermissionDenied = useCallback(() => {
		// 在显示弹窗之前立即重置状态
		console.log("Permission denied, resetting state immediately")
		onStateReset?.()

		const instructions =
			MicrophonePermissionService.getPermissionInstructions(permissionInstructions)
		const modalContent = (
			<>
				{permissionModal.content}
				<br />
				<br />
				{instructions}
			</>
		)

		const handleConfirm = () => {
			if (isIosMagicApp) {
				// Magic iOS App 内：跳转到系统设置
				try {
					window.location.href =
						"magic://magic.app/openwith?name=openSettingsURLString&url=app-settings%3A"
				} catch (error) {
					console.error("Failed to open iOS settings:", error)
					// 如果跳转失败，显示提示信息
					magicToast.info(permissionModal.manualInstruction)
				}
			} else {
				// 其他端：显示完成提示
				magicToast.info(permissionModal.manualInstruction)
			}
		}

		const handleCancel = () => {
			// 取消时不需要额外操作，状态已经重置
		}

		// 根据平台设置不同的按钮文本
		const confirmText = isIosMagicApp ? "打开设置" : permissionModal.okText

		if (isMobile) {
			// 移动端使用 antd-mobile Dialog
			Dialog.confirm({
				title: permissionModal.title,
				content: modalContent,
				confirmText,
				cancelText: permissionModal.cancelText,
				onConfirm: handleConfirm,
				onCancel: handleCancel,
			})
		} else {
			// PC端使用 antd Modal
			Modal.confirm({
				title: permissionModal.title,
				content: modalContent,
				okText: confirmText,
				cancelText: permissionModal.cancelText,
				onOk: handleConfirm,
				onCancel: handleCancel,
				centered: true,
			})
		}
	}, [permissionModal, isMobile, permissionInstructions, onStateReset])

	/**
	 * 检查错误是否为权限被拒绝
	 */
	const isPermissionDeniedError = useCallback((error: Error & { name?: string }): boolean => {
		return MicrophonePermissionService.isPermissionDeniedError(error)
	}, [])

	/**
	 * 统一的权限错误处理
	 * 如果是NotAllowedError，显示权限引导；否则抛出原始错误
	 */
	const handlePermissionError = useCallback(
		(error: Error & { name?: string }) => {
			if (isPermissionDeniedError(error)) {
				handlePermissionDenied()
			} else {
				throw error
			}
		},
		[isPermissionDeniedError, handlePermissionDenied],
	)

	return {
		handlePermissionDenied,
		isPermissionDeniedError,
		handlePermissionError,
	}
}
