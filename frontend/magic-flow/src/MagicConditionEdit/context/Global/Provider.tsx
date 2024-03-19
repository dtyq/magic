import type { PropsWithChildren } from "react"
import React, { useMemo } from "react"
import { GlobalContext } from "./Context"

export type GlobalProviderProps = {
	leftDisabledPos: string[]
	disabledOperationPos: string[]
	showTitlePosList: string[]
}

export const GlobalProvider = ({
	leftDisabledPos,
	disabledOperationPos,
	showTitlePosList,
	children,
}: PropsWithChildren<GlobalProviderProps>) => {
	const value = useMemo(() => {
		return { leftDisabledPos, disabledOperationPos, showTitlePosList }
	}, [disabledOperationPos, leftDisabledPos, showTitlePosList])

	return <GlobalContext.Provider value={value}>{children}</GlobalContext.Provider>
}
