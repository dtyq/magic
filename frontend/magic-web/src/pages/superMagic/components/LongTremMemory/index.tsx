import { lazy, Suspense } from "react"
import { openAgentCommonModal } from "@/components/Agent/AgentCommonModal"
import type { LongTremMemoryProps } from "./LongTremMemory"
import type { NavigateToStateParams } from "@/pages/superMagic/services/routeManageService"

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
}: {
	onWorkspaceStateChange: (params: NavigateToStateParams) => void
}) {
	openAgentCommonModal({
		width: 900,
		footer: null,
		closable: false,
		centered: true,
		children: <LongTremMemory onWorkspaceStateChange={onWorkspaceStateChange} />,
	})
}

// @ts-ignore
window.openLongTremMemoryModal = openLongTremMemoryModal
