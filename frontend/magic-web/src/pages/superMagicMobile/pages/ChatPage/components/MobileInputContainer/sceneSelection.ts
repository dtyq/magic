import type { SceneStateStore } from "@/pages/superMagic/components/MainInputContainer/stores"

/** Clear the one-time scene selection after a mobile message is sent successfully. */
export function clearMobileSceneSelectionOnSendSuccess(
	store: Pick<SceneStateStore, "setCurrentScene">,
) {
	store.setCurrentScene(null)
}
