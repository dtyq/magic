import { useTranslation } from "react-i18next"
import { isMagicApp } from "@/utils/devices"

/**
 * Provide microphone permission translations for browser and native app environments.
 *
 * @returns Permission modal and instruction texts based on environment
 */
export function useMicrophonePermissionI18n() {
	const { t } = useTranslation("component")

	if (isMagicApp) {
		// Native apps only define platform-specific guidance for iOS and Android.
		// Keep browser-named fields usable by falling back to the app's general instructions.
		const defaultInstruction = t("voiceInput.permission.instructions.app.default")

		return {
			permissionModal: {
				title: t("voiceInput.permission.modal.app.title"),
				content: t("voiceInput.permission.modal.app.content"),
				okText: t("voiceInput.permission.modal.app.okText"),
				cancelText: t("voiceInput.permission.modal.app.cancelText"),
				manualInstruction: t("voiceInput.permission.modal.app.manualInstruction"),
			},
			permissionInstructions: {
				chrome: defaultInstruction,
				edge: defaultInstruction,
				firefox: defaultInstruction,
				safari: defaultInstruction,
				ios: t("voiceInput.permission.instructions.app.ios"),
				android: t("voiceInput.permission.instructions.app.android"),
				default: defaultInstruction,
			},
		}
	}

	return {
		// Permission modal texts
		permissionModal: {
			title: t("voiceInput.permission.modal.browser.title"),
			content: t("voiceInput.permission.modal.browser.content"),
			okText: t("voiceInput.permission.modal.browser.okText"),
			cancelText: t("voiceInput.permission.modal.browser.cancelText"),
			manualInstruction: t("voiceInput.permission.modal.browser.manualInstruction"),
		},
		// Permission instructions
		permissionInstructions: {
			chrome: t("voiceInput.permission.instructions.browser.chrome"),
			edge: t("voiceInput.permission.instructions.browser.edge"),
			firefox: t("voiceInput.permission.instructions.browser.firefox"),
			safari: t("voiceInput.permission.instructions.browser.safari"),
			ios: t("voiceInput.permission.instructions.browser.ios"),
			android: t("voiceInput.permission.instructions.browser.android"),
			default: t("voiceInput.permission.instructions.browser.default"),
		},
	}
}
