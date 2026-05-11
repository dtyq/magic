import { useCallback } from "react"
import { showMicrophonePermissionDialog } from "@/components/business/VoiceInput/components/MicrophonePermissionDialog/utils"
import { useMicrophonePermissionI18n } from "@/hooks/useMicrophonePermissionI18n"
import { MicrophonePermissionService } from "@/services/MicrophonePermissionService"
import { isIosMagicApp } from "@/utils/devices"
import magicToast from "@/components/base/MagicToaster/utils"

interface UseMicrophonePermissionOptions {
	onStateReset?: () => void // 状态重置回调，在显示权限弹窗时立即调用
}

/**
 * 通用麦克风权限处理hook
 * 使用统一的权限引导弹窗处理桌面端和移动端
 */
export function useMicrophonePermission(options?: UseMicrophonePermissionOptions) {
	const { onStateReset } = options || {}
	const { permissionModal, permissionInstructions } = useMicrophonePermissionI18n()

	/**
	 * 处理麦克风权限被拒绝的情况
	 * 根据平台文案显示权限设置引导弹窗
	 */
	const handlePermissionDenied = useCallback(() => {
		console.log("Permission denied, resetting state immediately")
		onStateReset?.()

		const instructions =
			MicrophonePermissionService.getPermissionInstructions(permissionInstructions)

		const handleConfirm = () => {
			if (isIosMagicApp) {
				try {
					window.location.href =
						"magic://magic.app/openwith?name=openSettingsURLString&url=app-settings%3A"
				} catch (error) {
					console.error("Failed to open iOS settings:", error)
					magicToast.info(permissionModal.manualInstruction)
				}
			} else {
				magicToast.info(permissionModal.manualInstruction)
			}
		}

		void showMicrophonePermissionDialog({
			title: permissionModal.title,
			description: permissionModal.content,
			instructions,
			confirmText: permissionModal.okText,
			cancelText: permissionModal.cancelText,
			onConfirm: handleConfirm,
		})
	}, [permissionModal, permissionInstructions, onStateReset])

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
