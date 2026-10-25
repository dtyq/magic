import { useCallback } from "react"
import type { MicroAppListItem } from "@/apis/modules/superMagic"

/**
 * The open-source edition has no collaborator-management UI. Keep this hook
 * as the shared seam so the enterprise overlay can provide the real panel
 * without importing enterprise-only APIs or components into the public code.
 */
export function useMicroAppCollaboratorManagement() {
	const openCollaboratorManager = useCallback((_app: MicroAppListItem) => {}, [])

	return {
		canManageCollaborators: false,
		loadingAppId: null as string | null,
		openCollaboratorManager,
		CollaboratorUpdatePanel: null,
	}
}

export default useMicroAppCollaboratorManagement
