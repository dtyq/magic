import { ChevronsUpDown } from "lucide-react"
import UserAvatarRender from "@/components/business/UserAvatarRender"
import { Button } from "@/components/shadcn-ui/button"
import OrganizationRender from "@/components/business/OrganizationRender"
import GlobalSidebarStore from "@/stores/display/GlobalSidebarStore"
import { useMemoizedFn } from "ahooks"
import { userStore } from "@/models/user"
import { observer } from "mobx-react-lite"
import { useTranslation } from "react-i18next"

function UserInfoHeader() {
	const { t } = useTranslation("sidebar")

	const { userInfo } = userStore.user

	const handleOrganizationSwitch = useMemoizedFn(() => {
		GlobalSidebarStore.openOrganizationSwitch()
	})

	return (
		<div className="flex w-full items-center justify-between gap-2">
			{/* 用户信息 */}
			<div className="flex w-full items-center gap-2">
				<UserAvatarRender userInfo={userInfo} size={42} className="!rounded-lg" />
				<div className="flex flex-1 flex-col items-start justify-center gap-0 text-foreground">
					<div className="text-xs opacity-70">Hello!</div>
					<div className="h-[23px] text-lg font-semibold">
						{userInfo?.nickname || t("footer.defaultUser")}
					</div>
				</div>
			</div>

			<Button
				variant="ghost"
				className="flex h-8 items-center gap-1 rounded-lg bg-transparent !p-1.5 text-xs text-foreground"
				onClick={handleOrganizationSwitch}
			>
				<OrganizationRender organizationCode={userInfo?.organization_code} />
				<ChevronsUpDown className="size-4" />
			</Button>
		</div>
	)
}

export default observer(UserInfoHeader)
