import { isPrivateDeployment } from "@/utils/env"

/**
 * Whether the AI research (persona research) product entries are available in this deployment.
 * Open on SaaS, closed on private deployments; there is no separate switch.
 */
export const isPersonaResearchEnabled = (): boolean => !isPrivateDeployment()
