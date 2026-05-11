import { lazy, Suspense } from "react"
import { openAgentCommonModal } from "@/components/Agent/AgentCommonModal"
import type { LongTremMemoryProps } from "./LongTremMemory"
import type { NavigateToStateParams } from "@/pages/superMagic/services/routeManageService"
import { LongTremMemoryPage } from "./types"
import type { LongMemory } from "@/types/longMemory"

const LongTremMemoryModal = lazy(() => import("./LongTremMemory"))

export function LongTremMemory(props: LongTremMemoryProps) {
	return (
		<Suspense fallback={null}>
			<LongTremMemoryModal {...props} />
		</Suspense>
	)
}

export function preloadLongTremMemoryModal() {
	return import("./LongTremMemory")
}

export function openLongTremMemoryModal({
	onWorkspaceStateChange,
	initialPage,
	initialEditMemory,
	initialSelectedProjectId,
	closeOnCreateSuccess,
	onClose,
	onMemoryChanged,
}: {
	onWorkspaceStateChange: (params: NavigateToStateParams) => void
	initialPage?: LongTremMemoryPage
	initialEditMemory?: LongMemory.Memory
	initialSelectedProjectId?: string
	closeOnCreateSuccess?: boolean
	onClose?: () => void
	onMemoryChanged?: () => void
}) {
	openAgentCommonModal({
		width: 900,
		footer: null,
		closable: false,
		centered: true,
		onClose,
		children: (
			<LongTremMemory
				onWorkspaceStateChange={onWorkspaceStateChange}
				initialPage={initialPage}
				initialEditMemory={initialEditMemory}
				initialSelectedProjectId={initialSelectedProjectId}
				closeOnCreateSuccess={closeOnCreateSuccess}
				onMemoryChanged={onMemoryChanged}
			/>
		),
	})
}

// @ts-ignore
window.openLongTremMemoryModal = openLongTremMemoryModal
