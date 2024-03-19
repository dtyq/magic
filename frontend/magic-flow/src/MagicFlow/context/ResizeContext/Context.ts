import React from "react"

export type ResizeCtx = React.PropsWithChildren<{
    windowSize: {
        width: number
        height: number
    }
}>  

export const ResizeContext = React.createContext({
	windowSize: {
        width: 0,
        height: 0
    }
} as ResizeCtx)
