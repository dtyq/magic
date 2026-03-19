import { configStore } from "@/models/config"
import { userStore } from "@/models/user"
import superMagicModeService from "@/services/superMagic/SuperMagicModeService"
import { reaction } from "mobx"
import { useEffect } from "react"

/**
 * 更新模式列表
 * @deprecated
 */
function useUpdateModeList() {
	useEffect(() => {
		return reaction(
			() => [configStore.i18n.language, userStore.user.organizationCode],
			([_, organizationCode]) => {
				if (organizationCode) {
					superMagicModeService.startRefreshTimer()
					superMagicModeService.fetchModeList()
				} else {
					superMagicModeService.stopRefreshTimer()
				}
			},
		)
	}, [])
}

export default useUpdateModeList
