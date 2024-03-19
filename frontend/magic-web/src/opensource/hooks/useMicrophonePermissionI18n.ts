import { useTranslation } from "react-i18next"
import { isMagicApp } from "@/opensource/utils/devices"

/**
 * 麦克风权限国际化hook
 * 提供麦克风权限相关的国际化文本，根据环境（浏览器/App）返回不同的提示词
 *
 * @returns Permission modal and instruction texts based on environment
 */
export function useMicrophonePermissionI18n() {
	const { t } = useTranslation("component")

	// 根据是否在App环境中决定使用哪套文案
	const envType = isMagicApp ? "app" : "browser"

	return {
		// Permission modal texts
		permissionModal: {
			title: t(`voiceInput.permission.modal.${envType}.title`),
			content: t(`voiceInput.permission.modal.${envType}.content`),
			okText: t(`voiceInput.permission.modal.${envType}.okText`),
			cancelText: t(`voiceInput.permission.modal.${envType}.cancelText`),
			manualInstruction: t(`voiceInput.permission.modal.${envType}.manualInstruction`),
		},
		// Permission instructions
		permissionInstructions: {
			chrome: t(`voiceInput.permission.instructions.${envType}.chrome`),
			edge: t(`voiceInput.permission.instructions.${envType}.edge`),
			firefox: t(`voiceInput.permission.instructions.${envType}.firefox`),
			safari: t(`voiceInput.permission.instructions.${envType}.safari`),
			ios: t(`voiceInput.permission.instructions.${envType}.ios`),
			android: t(`voiceInput.permission.instructions.${envType}.android`),
			default: t(`voiceInput.permission.instructions.${envType}.default`),
		},
	}
}
