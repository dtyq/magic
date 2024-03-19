/**
 * MessageEditorProvider configuration options
 */
export interface MessageEditorProviderConfig {
	/** Whether to enable voice input feature */
	enableVoiceInput?: boolean
}

/**
 * MessageEditorProvider context value
 */
export interface MessageEditorProviderValue {
	/** Feature configuration */
	config: MessageEditorProviderConfig
}
