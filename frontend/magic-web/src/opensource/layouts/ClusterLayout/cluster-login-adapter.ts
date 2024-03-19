import openAccountModal from "@/opensource/pages/login/AccountModal"
import { createClusterLoginAdapter } from "./cluster-login"

export const clusterLoginAdapter = createClusterLoginAdapter({
	openModal(params) {
		return openAccountModal(params)
	},
})
