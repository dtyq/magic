import groupInfoService from "@/opensource/services/groupInfo"
import userInfoService from "@/opensource/services/userInfo"

export const getDataContext = () => {
	return {
		userInfoService,
		groupInfoService,
	}
}
