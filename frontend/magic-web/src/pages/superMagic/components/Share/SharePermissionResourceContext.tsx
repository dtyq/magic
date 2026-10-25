import { createContext, type ReactNode, useContext } from "react"

import type { SharePermissionResource } from "./types"

const SharePermissionResourceContext = createContext<SharePermissionResource>("project")

/**
 * Marks the product resource that owns nested share dialogs. Project pages use the default value,
 * while micro-app pages inject their own permission group once for every file sharing entry point.
 */
export function SharePermissionResourceProvider({
	children,
	value,
}: {
	children: ReactNode
	value: SharePermissionResource
}) {
	return (
		<SharePermissionResourceContext.Provider value={value}>
			{children}
		</SharePermissionResourceContext.Provider>
	)
}

export function useSharePermissionResource() {
	return useContext(SharePermissionResourceContext)
}
