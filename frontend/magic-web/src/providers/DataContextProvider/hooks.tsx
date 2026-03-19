import groupInfoService from "@/services/groupInfo"
import userInfoService from "@/services/userInfo"

export const getDataContext = () => {
	return {
		userInfoService,
		groupInfoService,
	}
}
