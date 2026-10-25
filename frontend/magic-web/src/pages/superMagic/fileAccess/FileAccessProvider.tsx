import { createContext, useContext, type ReactNode } from "react"
import type { FileAccessContext } from "./fileAccessContext"

const FileAccessReactContext = createContext<FileAccessContext | null>(null)

export function FileAccessProvider({
	value,
	children,
}: {
	value: FileAccessContext | null
	children: ReactNode
}) {
	return (
		<FileAccessReactContext.Provider value={value}>{children}</FileAccessReactContext.Provider>
	)
}

export function useFileAccess(): FileAccessContext | null {
	return useContext(FileAccessReactContext)
}
