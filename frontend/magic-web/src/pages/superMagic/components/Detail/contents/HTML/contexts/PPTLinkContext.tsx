import { createContext, useContext } from "react"

export interface PPTLinkOptions {
	currentSlidePath: string
	slides: readonly { path: string; title?: string }[]
}

// Scoped to the owning PPT slide; floating editor portals retain this context.
export const PPTLinkContext = createContext<PPTLinkOptions | null>(null)
export const usePPTLinkOptions = () => useContext(PPTLinkContext)
