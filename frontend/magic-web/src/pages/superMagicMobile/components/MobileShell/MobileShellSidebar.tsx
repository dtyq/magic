import { memo, useMemo, useState } from "react"
import { observer } from "mobx-react-lite"
import { useMemoizedFn } from "ahooks"
import { useTranslation } from "react-i18next"
import { InfiniteScroll } from "antd-mobile"
import { RefreshCw } from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/shadcn-ui/avatar"
import { cn } from "@/lib/utils"
import { userStore } from "@/models/user"
import { getAvatarColor } from "@/utils/avatar-color"
import { MobileBrandLogo } from "@/pages/superMagicMobile/components/MobileBrandLogo"
import { useMobileSettingsController } from "@/pages/superMagicMobile/components/MobileShell/MobileSettingsContext"
import { useProjectListActions } from "@/pages/superMagicMobile/components/ProjectList/hooks/useProjectActions"

import {
	type MobileShellMenuNavIcon,
	type MobileShellMenuRecentItem,
	useMobileShellMenu,
} from "./MobileShellMenuContext"
import { useMobileShellUpgradeAction } from "./useMobileShellUpgradeAction"
import { SHELL_RECENT_CHAT_ACTION_KEYS } from "@/pages/superMagicMobile/utils/mobileProjectActionOrder"
import { useMobileShellVisibleActionKeys } from "./hooks/useMobileShellVisibleActionKeys"
import { MobileShellRecentFloatingMenu } from "./MobileShellRecentFloatingMenu"
import { MobileShellRecentItemRow } from "./MobileShellRecentItemRow"

export interface MobileShellSidebarProps {
	/** 复用壳层前缀，保证不同页面的 `data-testid` 不冲突。 */
	testIdPrefix?: string
}

const PRIMARY_NAV_KEYS = new Set(["chats", "workspaces", "recording"])

const ACCOUNT_PILL_BOX_SHADOW = "rgb(0 0 0 / 17%) 0px 10px 20px -12px"

/** 统一计算侧栏导航行样式；导航项不展示路由选中高亮，仅保留按压反馈。 */
function navRowClass() {
	return cn(
		"flex h-9 w-full items-center gap-2 rounded-lg px-2 text-left text-base text-foreground transition-colors active:bg-black/5 dark:active:bg-white/10",
	)
}

/**
 * Renders primary sidebar nav icons at a fixed 16px box to match the prototype (`w-4 h-4`).
 * MagiClaw uses a 16×16 viewBox; do not scale this wrapper larger or its stroke looks too heavy.
 */
function NavMenuIcon({ icon: Icon }: { icon: MobileShellMenuNavIcon }) {
	return <Icon className="size-4 shrink-0 text-foreground" aria-hidden />
}

/** Super 移动端共享侧栏：业务页只传菜单数据，不再各自维护重复的侧栏视图。 */
const MobileShellSidebarView = observer(function MobileShellSidebarView({
	testIdPrefix = "mobile-super-shell",
}: MobileShellSidebarProps) {
	const { t } = useTranslation("super")
	const { t: tCommon } = useTranslation("common")
	const { t: tSidebar } = useTranslation("sidebar")
	const {
		navItems,
		recentItems,
		hasMore,
		onNavigate,
		onGoHome,
		onRecentNavigate,
		reloadRecentItems,
		loadMoreRecentItems,
	} = useMobileShellMenu()

	// Same source as PC: initGlobalConfig injects platform_settings.name_i18n into common:platform.name.
	const appName = tCommon("platform.name") || t("mobile.shell.brandName")
	const displayName = userStore.user.userInfo?.nickname?.trim() || tSidebar("footer.defaultUser")
	const avatarUrl = userStore.user.userInfo?.avatar?.trim() || ""
	const initial = displayName.charAt(0).toUpperCase() || "?"
	const avatarColors = useMemo(() => getAvatarColor(displayName), [displayName])
	const primaryNavItems = useMemo(
		() => navItems.filter(({ key }) => PRIMARY_NAV_KEYS.has(key)),
		[navItems],
	)
	const secondaryNavItems = useMemo(
		() => navItems.filter(({ key }) => !PRIMARY_NAV_KEYS.has(key)),
		[navItems],
	)
	const { openSettings } = useMobileSettingsController()
	const shellProjectActionKeys = useMobileShellVisibleActionKeys()
	const {
		projectActions: defaultProjectActions,
		updateCurrentActionItem: updateDefaultActionItem,
		openActionsPopup,
		projectActionComponents,
	} = useProjectListActions({
		actionContext: "shell-recent",
		onProjectChanged: reloadRecentItems,
		visibleActionKeys: shellProjectActionKeys,
	})
	const {
		projectActions: chatProjectActions,
		updateCurrentActionItem: updateChatActionItem,
		openActionsPopup: openChatActionsPopup,
		projectActionComponents: chatProjectActionComponents,
	} = useProjectListActions({
		mode: "chat",
		onProjectChanged: reloadRecentItems,
		visibleActionKeys: SHELL_RECENT_CHAT_ACTION_KEYS,
	})
	const {
		isVisible: isUpgradeVisible,
		label: upgradeLabel,
		handleUpgradeClick,
		handleUpgradePreload,
	} = useMobileShellUpgradeAction()
	const [isRefreshingRecent, setIsRefreshingRecent] = useState(false)
	const [floatingMenu, setFloatingMenu] = useState<{
		itemId: string
		isChatProject: boolean
		anchor: { clientX: number; clientY: number }
	} | null>(null)

	const floatingMenuActions = floatingMenu
		? floatingMenu.isChatProject
			? chatProjectActions
			: defaultProjectActions
		: []

	const closeFloatingMenu = useMemoizedFn(() => {
		setFloatingMenu(null)
	})

	/** Long press opens prototype-style floating menu; "more" keeps the bottom sheet. */
	const handleOpenRecentItemActions = useMemoizedFn(
		(
			item: MobileShellMenuRecentItem,
			source: "more" | "longPress",
			anchor?: { clientX: number; clientY: number },
		) => {
			if (!item.project) return

			if (source === "longPress" && anchor) {
				if (item.isChatProject) {
					updateChatActionItem(item.project)
				} else {
					updateDefaultActionItem(item.project)
				}

				setFloatingMenu({
					itemId: item.id,
					isChatProject: item.isChatProject,
					anchor,
				})
				return
			}

			if (item.isChatProject) {
				openChatActionsPopup(item.project)
				return
			}

			openActionsPopup(item.project)
		},
	)

	/** Manual refresh for the recent-projects block; reuses shell menu reload to reset pagination. */
	const handleRefreshRecent = useMemoizedFn(async () => {
		if (isRefreshingRecent || !reloadRecentItems) return

		setIsRefreshingRecent(true)
		try {
			await reloadRecentItems()
		} finally {
			setIsRefreshingRecent(false)
		}
	})

	// Background comes from MobileShellScaffold root (prototype Sidebar has no own fill).
	return (
		<div className="mobile-shell-sidebar flex h-full min-h-0 flex-col">
			<div className="flex shrink-0 items-center justify-between px-2 pb-2 pt-2">
				<button
					type="button"
					className="flex h-9 items-center gap-1 text-left"
					onClick={onGoHome}
					aria-label={t("mobile.shell.brandGoHome")}
					data-testid={`${testIdPrefix}-brand-button`}
				>
					<div className="relative flex h-9 w-9 shrink-0 items-center justify-center">
						<MobileBrandLogo
							className="mt-[-6px] h-9 w-9 shrink-0"
							logoPixelSize={36}
						/>
					</div>
					<span className="text-[20px] font-medium leading-none text-foreground">
						{appName}
					</span>
				</button>
			</div>

			<div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-contain px-3 pb-4">
				<div className="flex flex-col gap-2.5">
					<div className="flex flex-col gap-1">
						{primaryNavItems.map(({ key, icon: Icon, label }) => {
							return (
								<button
									key={key}
									type="button"
									onClick={() => onNavigate(key)}
									data-testid={`${testIdPrefix}-nav-${key}`}
									className={navRowClass()}
								>
									<NavMenuIcon icon={Icon} />
									<span className="leading-6">{label}</span>
								</button>
							)
						})}
					</div>

					<div className="h-px shrink-0 bg-border" />

					<div className="flex flex-col gap-1">
						{secondaryNavItems.map(({ key, icon: Icon, label }) => {
							return (
								<button
									key={key}
									type="button"
									onClick={() => onNavigate(key)}
									data-testid={`${testIdPrefix}-nav-${key}`}
									className={navRowClass()}
								>
									<NavMenuIcon icon={Icon} />
									<span className="leading-6">{label}</span>
								</button>
							)
						})}
					</div>

					{recentItems.length > 0 && (
						<>
							<div className="h-px shrink-0 bg-border" />

							<div className="flex flex-col gap-1">
								<div className="flex h-8 items-center justify-between gap-2 px-2">
									<span className="truncate text-sm leading-5 text-muted-foreground">
										{t("mobile.shell.recentlyUsed")}
									</span>
									{reloadRecentItems && (
										<button
											type="button"
											onClick={() => void handleRefreshRecent()}
											disabled={isRefreshingRecent}
											aria-label={t("mobile.shell.refreshRecentlyUsed")}
											data-testid={`${testIdPrefix}-recent-refresh`}
											className={cn(
												"flex size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors active:bg-black/5 dark:active:bg-white/10",
												isRefreshingRecent &&
													"pointer-events-none opacity-60",
											)}
										>
											<RefreshCw
												className={cn(
													"size-4 shrink-0",
													isRefreshingRecent && "animate-spin",
												)}
												aria-hidden
											/>
										</button>
									)}
								</div>
								{recentItems.map((item) => (
									<MobileShellRecentItemRow
										key={item.id}
										item={item}
										testIdPrefix={testIdPrefix}
										moreAriaLabel={t("common.more")}
										isContextMenuOpen={floatingMenu?.itemId === item.id}
										onRecentNavigate={onRecentNavigate}
										onOpenActions={handleOpenRecentItemActions}
									/>
								))}
								{hasMore && (
									<InfiniteScroll
										hasMore={hasMore}
										loadMore={loadMoreRecentItems}
									/>
								)}
							</div>
						</>
					)}
				</div>
			</div>

			<div className="dark:border-white/12 flex shrink-0 items-center justify-between gap-2 px-3 pb-3">
				<div className="flex min-w-0 items-center gap-2">
					<button
						type="button"
						title={displayName}
						onClick={openSettings}
						className="flex min-w-0 items-center gap-[6px] rounded-full bg-card py-[6px] pl-[6px] pr-[10px] text-left transition-opacity active:opacity-60"
						style={{ boxShadow: ACCOUNT_PILL_BOX_SHADOW }}
						data-testid={`${testIdPrefix}-account-pill`}
					>
						{/* Prefer real avatar; colored initial fallback matches prototype when image is missing. */}
						<Avatar className="size-6">
							{avatarUrl ? (
								<AvatarImage src={avatarUrl} alt="" referrerPolicy="no-referrer" />
							) : null}
							<AvatarFallback
								className="text-[12px] font-semibold"
								style={{
									backgroundColor: avatarColors.bg,
									color: avatarColors.text,
								}}
							>
								{initial}
							</AvatarFallback>
						</Avatar>
						<span className="truncate text-[14px] font-medium leading-none text-foreground">
							{displayName}
						</span>
					</button>
				</div>
				{isUpgradeVisible && (
					<button
						type="button"
						data-testid={`${testIdPrefix}-upgrade-button`}
						className={cn(
							"flex h-10 shrink-0 items-center justify-center rounded-full border border-border bg-card px-[14px] text-sm font-medium leading-5 text-foreground transition-opacity active:opacity-70",
							"dark:ring-white/12 dark:bg-black dark:shadow-none dark:ring-1",
						)}
						onClick={handleUpgradeClick}
						onFocus={handleUpgradePreload}
						onMouseEnter={handleUpgradePreload}
					>
						{upgradeLabel}
					</button>
				)}
			</div>
			{floatingMenu && (
				<MobileShellRecentFloatingMenu
					actions={floatingMenuActions}
					position={floatingMenu.anchor}
					testIdPrefix={testIdPrefix}
					onClose={closeFloatingMenu}
				/>
			)}
			{projectActionComponents}
			{chatProjectActionComponents}
		</div>
	)
})

/** 导出 memo 包装，避免壳层开关时无关重渲染扩散。 */
export default memo(MobileShellSidebarView)
