import { useEffect, useMemo } from "react"
import { useMemoizedFn } from "ahooks"
import { observer } from "mobx-react-lite"
import {
	ArrowLeftRight,
	BarChart3,
	Building2,
	CircleUserRound,
	Gauge,
	Info,
	Laptop,
	LogOut,
	Mail,
	MessageSquare,
	Receipt,
	Settings as SettingsIcon,
	ShieldCheck,
	Smartphone,
	Sparkles,
	UserRound,
} from "lucide-react"
import { toast } from "sonner"
import { useTranslation } from "react-i18next"

import { Button } from "@/components/shadcn-ui/button"
import MagicAvatar from "@/components/base/MagicAvatar"
import { useUserInfo } from "@/models/user/hooks"
import { userStore } from "@/models/user"
import { cn } from "@/utils/cn"
import { isMagicApp } from "@/utils/devices"
import { toAboutUs } from "@/layouts/BaseLayoutMobile/utils/url"
import GlobalSidebarStore from "@/stores/display/GlobalSidebarStore"
import { getMobileSettingsConfig } from "./config"
import {
	MOBILE_SETTINGS_HEADER_ICON_BUTTON_CLASSNAME,
	MOBILE_SETTINGS_ROOT_SHEET_CLASSNAME,
} from "./constants"
import { MobileSettingsMenuSection } from "./components/MenuSection"
import { MobileSettingsFreePlanCard, MobileSettingsPaidPlanCard } from "./components/PlanCards"
import { MobileSettingsSheetContainer } from "./components/SheetContainer"
import type {
	MobileSettingsMenuItemConfig,
	MobileSettingsMenuSectionConfig,
	MobileSettingsRootItemKey,
} from "./types"
import {
	getMobileSettingsPointsOverview,
	openMobileSettingsSubscriptionUpgrade,
	refreshMobileSettingsPoints,
} from "./utils"
import { isPrivateDeployment } from "@/utils/env"

export { getMobileSettingsRootItemAction } from "./actions"

/**
 * 菜单配置只保留 key；渲染层负责补足图标、文案和值，避免动态数据污染配置文件。
 */
function buildMenuItemConfig(params: {
	itemKey: MobileSettingsRootItemKey
	pointsOverview: ReturnType<typeof getMobileSettingsPointsOverview>
	onSelectItem: (itemKey: MobileSettingsRootItemKey) => void
	t: (key: string) => string
}): MobileSettingsMenuItemConfig {
	const { itemKey, onSelectItem, pointsOverview, t } = params
	const pointsValue =
		pointsOverview.primaryPoints == null
			? "--"
			: new Intl.NumberFormat().format(pointsOverview.primaryPoints)
	const quotaValue = pointsOverview.personalQuota
		? `${new Intl.NumberFormat().format(pointsOverview.personalQuota.used)}/${new Intl.NumberFormat().format(pointsOverview.personalQuota.total)}`
		: "--"

	const handleClick = () => onSelectItem(itemKey)

	switch (itemKey) {
		case "pointsPurchase":
			return {
				icon: <Sparkles className="h-5 w-5" />,
				label:
					pointsOverview.role === "teamAdmin"
						? t("setting.teamPoints")
						: t("bonusPointsModal.bonusPoints"),
				value: pointsValue,
				onClick: handleClick,
				dataTestId: "mobile-settings-menu-points",
			}
		case "teamPoints":
			return {
				icon: <Building2 className="h-5 w-5" />,
				label: t("setting.teamPoints"),
				value: pointsValue,
				onClick: handleClick,
				dataTestId: "mobile-settings-menu-team-points",
			}
		case "personalQuota":
			return {
				icon: <Gauge className="h-5 w-5" />,
				label: t("setting.personalQuota"),
				value: quotaValue,
				onClick: handleClick,
				dataTestId: "mobile-settings-menu-personal-quota",
			}
		case "pointsDetail":
			return {
				icon: <BarChart3 className="h-5 w-5" />,
				label: t("bonusPointsModal.pointsDetail"),
				onClick: handleClick,
				dataTestId: "mobile-settings-menu-points-detail",
			}
		case "orderHistory":
			return {
				icon: <Receipt className="h-5 w-5" />,
				label: t("setting.orderRecords"),
				onClick: handleClick,
				dataTestId: "mobile-settings-menu-orders",
			}
		case "profile":
			return {
				icon: <UserRound className="h-5 w-5" />,
				label: t("setting.profile"),
				onClick: handleClick,
				dataTestId: "mobile-settings-menu-profile",
			}
		case "accountSecurity":
			return {
				icon: <ShieldCheck className="h-5 w-5" />,
				label: t("setting.accountSecurity"),
				onClick: handleClick,
				dataTestId: "mobile-settings-menu-account-security",
			}
		case "loginDevices":
			return {
				icon: <Laptop className="h-5 w-5" />,
				label: t("setting.loginDevices.label"),
				onClick: handleClick,
				dataTestId: "mobile-settings-menu-login-devices",
			}
		case "appSettings":
			return {
				icon: <SettingsIcon className="h-5 w-5" />,
				label: t("setting.appSettings"),
				onClick: handleClick,
				dataTestId: "mobile-settings-menu-app-settings",
			}
		case "feedback":
			return {
				icon: <MessageSquare className="h-5 w-5" />,
				label: t("setting.feedback"),
				onClick: handleClick,
				dataTestId: "mobile-settings-menu-feedback",
			}
		case "logout":
			return {
				icon: <LogOut className="h-5 w-5" />,
				label: t("common.logout"),
				onClick: handleClick,
				danger: true,
				chevron: false,
				dataTestId: "mobile-settings-menu-logout",
			}
	}
}

/**
 * 根面板只读取配置中声明过的入口，保持页面结构与能力清单来自同一份声明。
 */
function buildMenuSections(params: {
	pointsOverview: ReturnType<typeof getMobileSettingsPointsOverview>
	onSelectItem: (itemKey: MobileSettingsRootItemKey) => void
	t: (key: string) => string
}): MobileSettingsMenuSectionConfig[] {
	const { onSelectItem, pointsOverview, t } = params

	return getMobileSettingsConfig().sections.map((section) => ({
		key: section.key,
		items: section.items.map((itemKey) =>
			buildMenuItemConfig({
				itemKey,
				onSelectItem,
				pointsOverview,
				t,
			}),
		),
	}))
}

/** 设置主浮层承接一级菜单，只负责把配置声明渲染成真实菜单。 */
export const MobileSettingsRootSheet = observer(function MobileSettingsRootSheet(props: {
	open: boolean
	onClose: () => void
	onSelectItem: (itemKey: MobileSettingsRootItemKey) => void
}) {
	const { open, onClose, onSelectItem } = props
	const { t } = useTranslation("interface")
	const { userInfo } = useUserInfo()

	const displayName = userInfo?.nickname?.trim() || t("sider.userAccount")
	const phoneLine = userInfo?.phone
		? `${userInfo.country_code || ""} ${userInfo.phone}`.trim()
		: ""
	const emailLine = userInfo?.email || ""
	const pointsOverview = getMobileSettingsPointsOverview()
	const pointsValue =
		pointsOverview.primaryPoints == null
			? "--"
			: new Intl.NumberFormat().format(pointsOverview.primaryPoints)
	const subscriptionInfo = userStore.user.organizationSubscriptionInfo
	const isPaidPlan = Boolean(subscriptionInfo?.is_paid_plan)
	const currentOrganization = userStore.user.getOrganization()
	const isPersonalOrganization = userStore.user.isPersonalOrganization
	const isAdmin = userStore.user.isAdmin

	/** Refresh points when settings opens while preserving cached values during the request. */
	useEffect(() => {
		if (!open) return
		void refreshMobileSettingsPoints()
	}, [open])

	/** 购买入口缺少实现时统一回退到占位提示，避免调用方再关心细节。 */
	const handleComingSoon = useMemoizedFn(() => {
		toast.info(t("setting.comingSoon"))
	})

	/** 升级入口统一委托给能力注入层，根面板只保留共享交互。
	 * 先关闭 Settings Sheet，释放 vaul 对 document.body 施加的 position:fixed，
	 * 避免 iOS Safari 在 body fixed 状态下无法识别订阅弹窗内 overflow:auto 滚动容器的问题。
	 */
	const handleUpgrade = useMemoizedFn(() => {
		onClose()
		openMobileSettingsSubscriptionUpgrade(handleComingSoon)
	})

	/** 组织切换继续复用全局面板，避免本次结构拆分引入额外业务变化。 */
	const handleOpenOrganizationSwitch = useMemoizedFn(() => {
		GlobalSidebarStore.openOrganizationSwitch()
	})

	/** Magic App 内右上角 About 入口：先关 Sheet，再通过深链打开原生 About 页。 */
	const handleOpenAboutUs = useMemoizedFn(() => {
		onClose()
		toAboutUs()
	})

	const menuSections = useMemo(
		() =>
			buildMenuSections({
				onSelectItem,
				pointsOverview,
				t,
			}),
		// isAdmin and isPersonalOrganization drive dynamic config (enterprise overlay conditionally includes menu items)
		// eslint-disable-next-line react-hooks/exhaustive-deps
		[
			onSelectItem,
			pointsValue,
			pointsOverview.role,
			pointsOverview.personalQuota?.used,
			pointsOverview.personalQuota?.total,
			t,
			isAdmin,
			isPersonalOrganization,
		],
	)

	return (
		<MobileSettingsSheetContainer
			open={open}
			title={t("sider.settings")}
			sheetClassName={MOBILE_SETTINGS_ROOT_SHEET_CLASSNAME}
			onOpenChange={(nextOpen) => {
				if (!nextOpen) onClose()
			}}
			headerAction={
				isMagicApp ? (
					<Button
						type="button"
						variant="ghost"
						size="icon"
						onClick={handleOpenAboutUs}
						className={cn(
							MOBILE_SETTINGS_HEADER_ICON_BUTTON_CLASSNAME,
							"right-2.5 bg-card text-foreground",
						)}
						aria-label={t("setting.aboutUs")}
						data-testid="mobile-settings-header-about"
					>
						<Info className="size-[22px]" />
					</Button>
				) : undefined
			}
			// 底部显式预留安全区与额外滚动留白，避免最后一组菜单被 home indicator 视觉裁切。
			contentClassName="gap-2 px-3.5 pb-[calc(var(--safe-area-inset-bottom)+1rem)] pt-0"
			scrollEdgeFade={{
				fadeColor: "muted",
				contentDeps: [menuSections.length, isPaidPlan, pointsValue, pointsOverview.role],
			}}
			dataTestId="mobile-settings-root-sheet"
		>
			<div className="flex flex-col items-center gap-1 pt-0">
				<MagicAvatar
					src={userInfo?.avatar}
					size={80}
					shape="circle"
					imgClassName="!rounded-full"
					className="shadow-sm"
				>
					{displayName}
				</MagicAvatar>
				<div className="flex flex-col items-center">
					<div className="text-center text-2xl font-semibold leading-tight text-foreground">
						{displayName}
					</div>
					<div className="mt-1.5 flex flex-col items-center gap-0.5">
						{phoneLine ? (
							<div className="flex items-center gap-1.5 text-xs leading-4 text-muted-foreground">
								<Smartphone className="h-3.5 w-3.5 shrink-0" />
								<span className="tabular-nums">{phoneLine}</span>
							</div>
						) : null}
						{emailLine ? (
							<div className="flex max-w-64 items-center gap-1.5 text-xs leading-4 text-muted-foreground">
								<Mail className="h-3.5 w-3.5 shrink-0" />
								<span className="truncate">{emailLine}</span>
							</div>
						) : null}
					</div>
				</div>
				<button
					type="button"
					onClick={handleOpenOrganizationSwitch}
					className="mb-4 mt-2 inline-flex h-8 max-w-full items-center gap-1.5 self-center rounded-full border border-border bg-transparent pl-2.5 pr-3 text-foreground transition-colors active:bg-card"
					data-testid="mobile-settings-organization-switch"
				>
					{isPersonalOrganization ? (
						<CircleUserRound className="h-3.5 w-3.5 shrink-0" />
					) : (
						<Building2 className="h-3.5 w-3.5 shrink-0" />
					)}
					<span className="max-w-48 truncate text-sm leading-4">
						{currentOrganization?.organization_name ||
							userInfo?.organization_code ||
							t("bonusPointsModal.personalVersion")}
					</span>
					<ArrowLeftRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
				</button>
			</div>

			{!isPrivateDeployment() ? (
				<div className="shrink-0">
					{isPaidPlan ? (
						<MobileSettingsPaidPlanCard onUpgrade={handleUpgrade} />
					) : (
						<MobileSettingsFreePlanCard onUpgrade={handleUpgrade} />
					)}
				</div>
			) : null}

			{menuSections.map((section) => (
				<MobileSettingsMenuSection key={section.key} items={section.items} />
			))}
		</MobileSettingsSheetContainer>
	)
})
