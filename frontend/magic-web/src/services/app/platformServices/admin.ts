import { User } from "@/types/user"
import { AdminPlatformServiceInterface } from "../types/platformServiceInterface"
import { AppServiceContext } from "../types"
import { Platform } from "../const/platform"

class AdminPlatformService implements AdminPlatformServiceInterface {
	PlatformType: Platform = Platform.AdminPlatform
	private context: AppServiceContext

	constructor(context: AppServiceContext) {
		this.context = context
	}

	switchOrganization: (
		accountInfo: User.UserAccount,
		organizationInfo: User.MagicOrganization,
		userInfo: User.UserInfo | null,
		onSwitchAfter?: () => void,
	) => Promise<void> = async () => {
		return Promise.resolve()
	}
	initUserData: (magicUser: User.UserInfo) => Promise<void> = async () => {
		return Promise.resolve()
	}
}

export default AdminPlatformService
