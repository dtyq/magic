import type { ProjectListItem } from "@/pages/superMagic/pages/Workspace/types"

/**
 * Open-source stub: project transfer is enterprise-only.
 * Returns no-op values so callers do not break in the open-source build.
 */
function useProjectTransferModal(_project: ProjectListItem | null) {
	return {
		openTransferModal: () => {},
		TransferModalComponent: null as React.ReactNode,
	}
}

export default useProjectTransferModal
