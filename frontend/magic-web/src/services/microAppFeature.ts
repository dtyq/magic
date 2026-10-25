import { env, isPrivateDeployment } from "@/utils/env"

/** Whether micro-app product entries are available in this deployment. */
export const isMicroAppEnabled = (): boolean => {
	const enabled = env("MAGIC_MICRO_APP_ENABLED")
	if (enabled === "true") return true
	if (enabled === "false") return false

	// Preserve the deployment default when the override is absent or invalid.
	return !isPrivateDeployment()
}
