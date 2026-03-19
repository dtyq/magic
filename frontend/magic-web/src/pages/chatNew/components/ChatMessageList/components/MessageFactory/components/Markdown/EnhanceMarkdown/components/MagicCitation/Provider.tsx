import type { AggregateAISearchCardSearch } from "@/types/chat/conversation_message"
import type { ReactNode } from "react"
import { createContext, useMemo } from "react"

export const MagicCitationContext = createContext<{
	sources: AggregateAISearchCardSearch[]
}>({ sources: [] })

const MagicCitationProvider = ({
	sources,
	children,
}: {
	sources: AggregateAISearchCardSearch[] | undefined
	children: ReactNode
}) => {
	const value = useMemo(() => {
		return {
			sources: sources ?? [],
		}
	}, [sources])

	return <MagicCitationContext.Provider value={value}>{children}</MagicCitationContext.Provider>
}

export default MagicCitationProvider
