/**
 * 配置变更监听器上下文
 */
import { useEventEmitter } from "ahooks"
import { EventEmitter } from "ahooks/lib/useEventEmitter"
import React, { useContext, useMemo } from "react"

type NodeChangeListenerContextProps = {
	customListener?: EventEmitter<string>
}

const NodeChangeListenerContext = React.createContext({
	nodeChangeEventListener: new EventEmitter<string>(),
})

export const NodeChangeListenerProvider = ({
	customListener,
	children,
}: React.PropsWithChildren<NodeChangeListenerContextProps>) => {
	const nodeChangeEventListener = useEventEmitter<string>()

	const value = useMemo(() => {
		return {
			nodeChangeEventListener: customListener || nodeChangeEventListener,
		}
	}, [nodeChangeEventListener])

	return (
		<NodeChangeListenerContext.Provider value={value}>
			{children}
		</NodeChangeListenerContext.Provider>
	)
}

export const useNodeChangeListener = () => {
	return useContext(NodeChangeListenerContext)
}
