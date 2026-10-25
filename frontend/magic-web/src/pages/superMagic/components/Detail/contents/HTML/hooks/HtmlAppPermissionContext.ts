import { createContext, useContext } from "react"
import type { HtmlAppPermissionController } from "./useHtmlAppPermissions"

export const HtmlAppPermissionContext = createContext<HtmlAppPermissionController | null>(null)

export function useSharedHtmlAppPermissions() {
	return useContext(HtmlAppPermissionContext)
}
