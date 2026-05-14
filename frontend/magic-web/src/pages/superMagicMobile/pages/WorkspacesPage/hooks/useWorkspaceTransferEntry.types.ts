import type { ReactNode } from "react"
import type { Workspace } from "@/pages/superMagic/pages/Workspace/types"

export interface UseWorkspaceTransferEntryParams {
	workspace: Workspace | null
	onClose: () => void
}

export interface UseWorkspaceTransferEntryResult {
	showTransferEntry: boolean
	transferEntryLabel: string
	handleOpenTransfer: () => void
	transferNode: ReactNode
}
