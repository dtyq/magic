import { ChevronsUpDown } from "lucide-react"
import { Button } from "@/opensource/components/shadcn-ui/button"
import { lazy } from "react"
import { cn } from "@/opensource/lib/utils"
import { Avatar, AvatarFallback, AvatarImage } from "@/opensource/components/shadcn-ui/avatar"
import { preloadUserMenus } from "../../Header/utils/preloadUserMenus"
import DropdownLazyLoadWrapper from "../DropdownLazyLoadWrapper"
import UserAvatarRender from "@/opensource/components/business/UserAvatarRender"
import UserPlanInfo from "@/opensource/layouts/BaseLayout/components/MagicSidebar/components/UserPlanInfo"
import { useTranslation } from "react-i18next"
import { userStore } from "@/opensource/models/user"
import { observer } from "mobx-react-lite"

// Lazy load UserMenus
const UserMenus = lazy(() => import("../../UserMenus"))

interface UserInfoCardProps {
	collapsed: boolean
}

function UserInfoCard({ collapsed }: UserInfoCardProps) {
	const { t } = useTranslation("sidebar")
	const { userInfo } = userStore.user

	if (collapsed) {
		return (
			<div
				className="relative flex shrink-0 items-center gap-0 rounded-md"
				data-testid="sidebar-user-info-card"
			>
				<DropdownLazyLoadWrapper
					component={UserMenus}
					componentProps={{ placement: "right", initialOpen: true }}
					onPreload={preloadUserMenus}
				>
					<div className="w-full cursor-pointer">
						<Avatar className="h-8 w-8 rounded-lg">
							<AvatarImage src={userInfo?.avatar} />
							<AvatarFallback className="rounded-lg">
								{userInfo?.nickname?.[0]}
							</AvatarFallback>
						</Avatar>
					</div>
				</DropdownLazyLoadWrapper>
			</div>
		)
	}

	return (
		<div
			className="flex w-full shrink-0 flex-col items-start overflow-hidden"
			data-testid="sidebar-user-info-card"
		>
			<DropdownLazyLoadWrapper
				component={UserMenus}
				componentProps={{ placement: "right", initialOpen: true }}
				onPreload={preloadUserMenus}
			>
				<div
					className={cn(
						"flex w-full shrink-0 items-center gap-2 rounded-md p-2",
						"cursor-pointer hover:bg-sidebar-accent",
					)}
				>
					<UserAvatarRender className="rounded-lg" userInfo={userInfo} size={32} />
					<div className="flex min-h-px min-w-0 grow basis-0 flex-col items-start justify-center gap-0.5 overflow-hidden">
						<p className="w-full truncate text-sm font-semibold leading-5 text-[#030712] dark:text-[#f9fafb]">
							{userInfo?.nickname || t("footer.defaultUser")}
						</p>
						<UserPlanInfo />
					</div>

					<Button variant="ghost" size="icon" className="h-4 w-4 shrink-0 p-0">
						<ChevronsUpDown className="h-4 w-4" />
					</Button>
				</div>
			</DropdownLazyLoadWrapper>
		</div>
	)
}

export default observer(UserInfoCard)
