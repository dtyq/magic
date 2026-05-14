export const loadDeleteDangerModal = () => import("@/components/business/DeleteDangerModal")
export const loadMoveProjectModal = () => import("../components/MoveProjectModal")

let preloadProjectActionModalsPromise: Promise<void> | null = null

export function preloadProjectActionModals() {
	if (preloadProjectActionModalsPromise) return preloadProjectActionModalsPromise

	preloadProjectActionModalsPromise = Promise.allSettled([
		loadDeleteDangerModal(),
		loadMoveProjectModal(),
	]).then(() => undefined)

	return preloadProjectActionModalsPromise
}
