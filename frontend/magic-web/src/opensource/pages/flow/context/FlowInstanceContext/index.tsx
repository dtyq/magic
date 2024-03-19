import { MagicFlowInstance } from "@dtyq/magic-flow/dist/MagicFlow"
import React, { createContext, useContext, MutableRefObject, useMemo } from "react"

interface FlowInstanceContextProps {
	flowInstance: MutableRefObject<MagicFlowInstance | null>
}

const FlowInstanceContext = createContext<FlowInstanceContextProps | undefined>(undefined)

interface FlowInstanceProviderProps extends React.PropsWithChildren {
	flowInstance: MutableRefObject<MagicFlowInstance | null>
}

export const FlowInstanceProvider = ({ flowInstance, children }: FlowInstanceProviderProps) => {
	const value = useMemo(() => {
		return { flowInstance }
	}, [flowInstance])

	return <FlowInstanceContext.Provider value={value}>{children}</FlowInstanceContext.Provider>
}

export const useFlowInstance = (): FlowInstanceContextProps => {
	const value = useContext(FlowInstanceContext)
	return value || { flowInstance: { current: null } }
}

export default FlowInstanceProvider
