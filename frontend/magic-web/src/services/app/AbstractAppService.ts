import type { User } from "@/types/user"

export abstract class AbstractAppService<TInitResult = unknown> {
	abstract init(): Promise<TInitResult>

	abstract initUserData: (user: User.UserInfo) => Promise<void> | undefined

	abstract switchOrganization: (
		accountInfo: User.UserAccount,
		organizationInfo: User.MagicOrganization,
		userInfo: User.UserInfo | null,
		onSwitchAfter?: () => void,
	) => Promise<void>
}
