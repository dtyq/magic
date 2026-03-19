import { useTranslation } from "react-i18next"

/**
 * useVoiceInputI18n - VoiceInput component internationalization hook
 *
 * @returns Translation functions and text constants for VoiceInput
 */
export function useVoiceInputI18n() {
	const { t } = useTranslation("component")

	return {
		t,
		// Button texts
		buttonTexts: {
			pressToSpeak: t("voiceInput.button.pressToSpeak"),
			cancel: t("voiceInput.button.cancel"),
			convertToText: t("voiceInput.button.convertToText"),
			sendText: t("voiceInput.button.sendText"),
			sendVoice: t("voiceInput.button.sendVoice"),
			back: t("voiceInput.button.back"),
		},
		// Status texts
		statusTexts: {
			releaseToCancel: t("voiceInput.status.releaseToCancel"),
			releaseToSend: t("voiceInput.status.releaseToSend"),
		},
		// Placeholder texts
		placeholders: {
			textInput: t("voiceInput.placeholder.textInput"),
		},
		// Error messages
		errorMessages: {
			microphonePermissionDenied: t("voiceInput.error.microphonePermissionDenied"),
			microphoneNotFound: t("voiceInput.error.microphoneNotFound"),
			microphoneNotReadable: t("voiceInput.error.microphoneNotReadable"),
			microphoneOverconstrained: t("voiceInput.error.microphoneOverconstrained"),
			microphoneNotSupported: t("voiceInput.error.microphoneNotSupported"),
			microphoneSecurityError: t("voiceInput.error.microphoneSecurityError"),
			microphoneAccessFailed: t("voiceInput.error.microphoneAccessFailed"),
		},
		// Note: Permission modal and instructions are now handled by useMicrophonePermissionI18n
	}
}
