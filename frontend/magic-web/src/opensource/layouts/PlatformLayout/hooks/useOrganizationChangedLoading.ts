import { userStore } from "@/opensource/models/user"
import { interfaceStore } from "@/opensource/stores/interface"
import { useDebounceEffect } from "ahooks"
import { reaction } from "mobx"

export function useOrganizationChangedLoading() {
	useDebounceEffect(
		() => {
			return reaction(
				() => userStore.user.userInfo,
				async (magicUser, previousUser) => {
					if (magicUser) {
						const showSwitchLoading = previousUser?.user_id !== magicUser.user_id
						if (showSwitchLoading) {
							interfaceStore.setIsSwitchingOrganization(true)
							setTimeout(() => {
								interfaceStore.setIsSwitchingOrganization(false)
							})
						}
					}
				},
				{
					fireImmediately: true,
				},
			)
		},
		[],
		{
			wait: 1000,
		},
	)
}
