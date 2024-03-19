import {
	UserInfoHeader,
	PlanCard,
	ProfileExtraSection,
	AccountDetailsSection,
	AccountManagementSection,
	SystemSettingsSection,
	LogoutButton,
} from "./components"
import useLogout from "@/opensource/hooks/account/useLogout"
import { useMemoizedFn } from "ahooks"
import { useIsMobile } from "@/opensource/hooks/useIsMobile"
import { Navigate } from "@/opensource/routes/components/Navigate"
import { RouteName } from "@/opensource/routes/constants"
import { useState, useRef, useEffect } from "react"
import { observer } from "mobx-react-lite"
import { cn } from "@/opensource/lib/utils"
import { ChevronsUpDown } from "lucide-react"
import { Button } from "@/opensource/components/shadcn-ui/button"
import { useUserInfo } from "@/opensource/models/user/hooks"
import GlobalSidebarStore from "@/opensource/stores/display/GlobalSidebarStore"
import OrganizationRender from "@/opensource/components/business/OrganizationRender"
import UserAvatarRender from "@/opensource/components/business/UserAvatarRender"

function SuperMagicMobileMy() {
	const isMobile = useIsMobile()
	const { userInfo } = useUserInfo()

	const [isScrolled, setIsScrolled] = useState(false)
	const scrollContainerRef = useRef<HTMLDivElement>(null)

	const logout = useLogout()

	const handleLogout = useMemoizedFn(() => {
		logout()
	})

	const handleOrganizationSwitch = useMemoizedFn(() => {
		GlobalSidebarStore.openOrganizationSwitch()
	})

	// 滚动到顶部
	const scrollToTop = useMemoizedFn(() => {
		scrollContainerRef.current?.scrollTo({
			top: 0,
			behavior: "smooth",
		})
	})

	const handleScroll = useMemoizedFn(() => {
		const scrollContainer = scrollContainerRef.current
		if (!scrollContainer) return
		const scrollTop = scrollContainer.scrollTop
		setIsScrolled(scrollTop > 50)
	})

	// 监听滚动事件
	useEffect(() => {
		const scrollContainer = scrollContainerRef.current
		if (!scrollContainer) return

		scrollContainer.addEventListener("scroll", handleScroll)
		return () => {
			scrollContainer.removeEventListener("scroll", handleScroll)
		}
	}, [])

	if (!isMobile) {
		return <Navigate name={RouteName.Super} replace />
	}

	return (
		<div className={cn("relative h-full w-full bg-sidebar")}>
			{/* 固定的滚动后头部 */}
			<div
				className={cn(
					"fixed left-0 right-0 top-0 z-50 transition-transform duration-300",
					isScrolled ? "translate-y-0" : "-translate-y-full",
				)}
			>
				<div
					onClick={scrollToTop}
					className="overflow-hidden rounded-bl-xl rounded-br-xl bg-background pt-safe-top shadow-xs active:bg-gray-50"
				>
					{/* Header Container */}
					<div className="flex h-12 w-full items-center gap-2 overflow-hidden pl-3.5 pr-2.5">
						<div className="flex flex-1 items-center gap-2">
							<UserAvatarRender
								userInfo={userInfo}
								size={28}
								className="!rounded-lg"
							/>
							<div className="flex flex-1 flex-col items-start justify-center gap-0 text-foreground">
								<div className="text-[10px] leading-3 opacity-70">Hello!</div>
								<div className="text-sm font-semibold">
									{userInfo?.nickname || "User"}
								</div>
							</div>
						</div>
						<div className="flex items-center gap-1">
							<Button
								variant="ghost"
								onClick={handleOrganizationSwitch}
								className="h-8 gap-1 rounded-lg bg-transparent p-1.5 text-xs"
							>
								<OrganizationRender
									organizationCode={userInfo?.organization_code}
								/>
								<ChevronsUpDown className="size-4" />
							</Button>
						</div>
					</div>
				</div>
			</div>

			{/* 可滚动内容 */}
			<div
				ref={scrollContainerRef}
				className={cn(
					"h-full w-full overflow-y-auto bg-sidebar [&::-webkit-scrollbar]:hidden",
					`pb-safe-bottom-with-tabbar pt-safe-top`,
				)}
			>
				<div className="flex w-full flex-col justify-end gap-3.5 p-3.5">
					{/* 用户信息头部 + 背景 */}
					<UserInfoHeader />
					{/* 套餐卡片 */}
					{<PlanCard />}
				</div>

				{/* 主内容区 */}
				<div className="flex w-full flex-col items-stretch gap-4 px-3.5 py-4">
					<ProfileExtraSection />

					{/* 账户明细 */}
					<AccountDetailsSection />

					{/* 账户管理 */}
					<AccountManagementSection />

					{/* 系统设置 */}
					<SystemSettingsSection />

					{/* 退出登录按钮 */}
					<LogoutButton onLogout={handleLogout} />
				</div>
			</div>
		</div>
	)
}

export default observer(SuperMagicMobileMy)
