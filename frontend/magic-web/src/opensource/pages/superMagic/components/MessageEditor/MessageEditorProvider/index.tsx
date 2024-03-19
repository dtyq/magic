import { createContext, useContext, type PropsWithChildren } from "react"
import type { MessageEditorProviderConfig, MessageEditorProviderValue } from "./types"

const MessageEditorContext = createContext<MessageEditorProviderValue | null>(null)

export interface MessageEditorProviderProps extends PropsWithChildren {
	/** Provider configuration */
	config?: MessageEditorProviderConfig
}

/**
 * Default configuration values
 */
const DEFAULT_CONFIG: MessageEditorProviderConfig = {
	enableVoiceInput: true,
}

/**
 * MessageEditorProvider - Provides configuration for MessageEditor features
 *
 * @param props - Provider props
 * @returns JSX.Element
 */
function MessageEditorProvider({ children, config = {} }: MessageEditorProviderProps) {
	const value: MessageEditorProviderValue = {
		config: {
			...DEFAULT_CONFIG,
			...config,
		},
	}

	return <MessageEditorContext.Provider value={value}>{children}</MessageEditorContext.Provider>
}

/**
 * Hook to access MessageEditorProvider context
 * Returns default config if used outside MessageEditorProvider
 *
 * @returns MessageEditorProviderValue
 */
export function useMessageEditorProvider(): MessageEditorProviderValue {
	const context = useContext(MessageEditorContext)
	if (!context) {
		// Return default config if used outside provider
		return {
			config: DEFAULT_CONFIG,
		}
	}
	return context
}

export default MessageEditorProvider
