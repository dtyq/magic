import { createContext, useContext, type PropsWithChildren } from "react"
import type { ConversationInputLayoutContextValue } from "./types"

const ConversationInputLayoutContext = createContext<ConversationInputLayoutContextValue | null>(
	null,
)

/** Provide the current conversation layout contract to the editor container below it. */
export function ConversationInputLayoutProvider({
	value,
	children,
}: PropsWithChildren<{ value: ConversationInputLayoutContextValue }>) {
	return (
		<ConversationInputLayoutContext.Provider value={value}>
			{children}
		</ConversationInputLayoutContext.Provider>
	)
}

/** Read optional layout state without changing standalone editor behavior when no provider exists. */
export function useConversationInputLayout() {
	return useContext(ConversationInputLayoutContext)
}
