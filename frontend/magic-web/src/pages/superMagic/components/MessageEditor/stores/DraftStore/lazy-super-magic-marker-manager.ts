import { DraftData } from "../../types"
import { syncDraftMarkersToManager } from "../../utils/mention"

let superMagicMarkerManagerPromise: Promise<
	typeof import("@/pages/superMagic/components/Detail/contents/Design/marker-manager")
> | null = null

async function getSuperMagicMarkerManager() {
	if (!superMagicMarkerManagerPromise) {
		superMagicMarkerManagerPromise =
			import("@/pages/superMagic/components/Detail/contents/Design/marker-manager")
	}

	const { SuperMagicMarkerManager } = await superMagicMarkerManagerPromise
	return SuperMagicMarkerManager.getInstance()
}

export async function syncDraftMarkersToSuperMagicManager(draft: DraftData) {
	try {
		// Sync markers before restoring content to avoid stale canvas state.
		const markerManager = await getSuperMagicMarkerManager()
		syncDraftMarkersToManager(draft, (data) => {
			markerManager.syncFromCanvasMarkerMentionData(data)
		})
	} catch (error) {
		console.error("Failed to sync draft markers to manager:", error)
	}
}
