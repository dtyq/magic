import { memo, useMemo } from "react"
import { observer } from "mobx-react-lite"
import { useTranslation } from "react-i18next"
import { Ellipsis, Loader } from "lucide-react"
import { cn } from "@/lib/utils"
import { userStore } from "@/models/user"
import { MobileBrandLogoIcon } from "@/pages/superMagicMobile/components/icons/MobileBrandLogoIcon"
import { useMobileSettingsController } from "@/layouts/BaseLayoutMobileV2/MobileSettingsContext"
import { useProjectListActions } from "@/pages/superMagicMobile/components/ProjectList/hooks/useProjectActions"

import { MobilePinBadge } from "@/pages/superMagicMobile/components/icons/MobilePinBadge"
import { type MobileShellMenuNavIcon, useMobileShellMenu } from "./MobileShellMenuContext"
import { useMobileShellUpgradeAction } from "./useMobileShellUpgradeAction"

export interface MobileShellSidebarProps {
	/** 复用壳层前缀，保证不同页面的 `data-testid` 不冲突。 */
	testIdPrefix?: string
}

/** 统一计算侧栏导航行样式，避免各页面复制相同的选中态与主题态。 */
function navRowClass(isActive: boolean) {
	return cn(
		"flex h-9 w-full items-center gap-2 rounded-lg px-2 text-left text-base transition-colors",
		isActive
			? "dark:ring-white/12 bg-background text-foreground shadow-sm dark:bg-zinc-950 dark:shadow-md dark:ring-1"
			: "text-foreground active:bg-black/5 dark:active:bg-white/10",
	)
}

/** 统一渲染主导航图标，兼容 Lucide 图标与自定义 SVG 图标。 */
function NavMenuIcon({ icon: Icon }: { icon: MobileShellMenuNavIcon }) {
	return <Icon className="size-[18px] shrink-0 text-foreground" aria-hidden />
}

/** 关联工作区徽章图标（12×12，两个重叠方块） */
function LinkedBadgeIcon() {
	return (
		<svg
			width="12"
			height="12"
			viewBox="0 0 12 12"
			fill="none"
			xmlns="http://www.w3.org/2000/svg"
			aria-hidden
		>
			<path
				d="M9.5 4.134C9.65202 4.22177 9.77825 4.348 9.86602 4.50001C9.95379 4.65203 10 4.82447 10 5V9C10 9.26522 9.89464 9.51957 9.70711 9.70711C9.51957 9.89464 9.26522 10 9 10H5C4.73478 10 4.48043 9.89464 4.29289 9.70711C4.10536 9.51957 4 9.26522 4 9V5C4 4.73478 4.10536 4.48043 4.29289 4.29289C4.48043 4.10536 4.73478 4 5 4H6.5M2.5 7.867C2.34784 7.77915 2.22151 7.65276 2.13373 7.50055C2.04595 7.34835 1.99983 7.1757 2 7V3C2 2.73478 2.10536 2.48043 2.29289 2.29289C2.48043 2.10536 2.73478 2 3 2H7C7.26522 2 7.51957 2.10536 7.70711 2.29289C7.89464 2.48043 8 2.73478 8 3V7C8 7.26522 7.89464 7.51957 7.70711 7.70711C7.51957 7.89464 7.26522 8 7 8H5.5"
				stroke="currentColor"
				strokeLinecap="round"
				strokeLinejoin="round"
			/>
		</svg>
	)
}

/** 协作共享徽章图标（12×12，用户分享图标） */
function SharedBadgeIcon() {
	return (
		<svg
			width="12"
			height="12"
			viewBox="0 0 12 12"
			fill="none"
			xmlns="http://www.w3.org/2000/svg"
			aria-hidden
		>
			<path
				d="M2.5 3.5C2.5 4.03043 2.71071 4.53914 3.08579 4.91421C3.46086 5.28929 3.96957 5.5 4.5 5.5C5.03043 5.5 5.53914 5.28929 5.91421 4.91421C6.28929 4.53914 6.5 4.03043 6.5 3.5C6.5 2.96957 6.28929 2.46086 5.91421 2.08579C5.53914 1.71071 5.03043 1.5 4.5 1.5C3.96957 1.5 3.46086 1.71071 3.08579 2.08579C2.71071 2.46086 2.5 2.96957 2.5 3.5Z"
				stroke="currentColor"
				strokeLinecap="round"
				strokeLinejoin="round"
			/>
			<path
				d="M1.5 10.5V9.5C1.5 8.96957 1.71071 8.46086 2.08579 8.08579C2.46086 7.71071 2.96957 7.5 3.5 7.5H5.5C6.03043 7.5 6.53914 7.71071 6.91421 8.08579C7.28929 8.46086 7.5 8.96957 7.5 9.5V10.5"
				stroke="currentColor"
				strokeLinecap="round"
				strokeLinejoin="round"
			/>
			<path
				d="M8 1.565C8.43021 1.67515 8.81152 1.92535 9.08382 2.27616C9.35612 2.62696 9.50392 3.05841 9.50392 3.5025C9.50392 3.94659 9.35612 4.37804 9.08382 4.72884C8.81152 5.07965 8.43021 5.32985 8 5.44"
				stroke="currentColor"
				strokeLinecap="round"
				strokeLinejoin="round"
			/>
			<path
				d="M10.5 10.5V9.5C10.4975 9.05858 10.349 8.6304 10.0776 8.2822C9.80631 7.934 9.42741 7.68535 9 7.575"
				stroke="currentColor"
				strokeLinecap="round"
				strokeLinejoin="round"
			/>
		</svg>
	)
}

/** Super 移动端共享侧栏：业务页只传菜单数据，不再各自维护重复的侧栏视图。 */
const MobileShellSidebarView = observer(function MobileShellSidebarView({
	testIdPrefix = "mobile-super-shell",
}: MobileShellSidebarProps) {
	const { t } = useTranslation("super")
	const { t: tSidebar } = useTranslation("sidebar")
	const {
		activeView,
		navItems,
		recentItems,
		onNavigate,
		onGoHome,
		onRecentNavigate,
		reloadRecentItems,
	} = useMobileShellMenu()

	const appName = useMemo(() => t("mobile.shell.brandName"), [t])
	const displayName = userStore.user.userInfo?.nickname?.trim() || tSidebar("footer.defaultUser")
	const avatarUrl = userStore.user.userInfo?.avatar?.trim() || ""
	const initial = displayName.charAt(0).toUpperCase() || "?"
	const primaryNavItems = useMemo(() => navItems.slice(0, 3), [navItems])
	const secondaryNavItems = useMemo(() => navItems.slice(3), [navItems])
	const { openSettings } = useMobileSettingsController()
	const { openActionsPopup, projectActionComponents } = useProjectListActions({
		onProjectChanged: reloadRecentItems,
		// Match prototype: rename / move to / add collaborators / transfer / delete (no pin in this menu).
		visibleActionKeys: ["rename", "move", "setCollaborators", "transfer", "delete"],
	})
	const {
		isVisible: isUpgradeVisible,
		label: upgradeLabel,
		handleUpgradeClick,
		handleUpgradePreload,
	} = useMobileShellUpgradeAction()

	return (
		<div className="flex h-full min-h-0 flex-col bg-muted dark:bg-neutral-800">
			{/* 顶部品牌区与 prototype 头部对齐，统一由共享侧栏维护。 */}
			<div
				className="flex shrink-0 items-center justify-between px-2 pb-2"
				style={{ paddingTop: "calc(var(--safe-area-inset-top, 0px) + 8px)" }}
			>
				<button
					type="button"
					className="flex h-9 items-center gap-1 text-left"
					onClick={onGoHome}
					aria-label={t("mobile.shell.brandGoHome")}
					data-testid={`${testIdPrefix}-brand-button`}
				>
					<div className="relative flex h-9 w-9 shrink-0 items-center justify-center">
						{/* 头部品牌位使用原型中的真实 Logo，避免与菜单内的 MagiClaw 功能图标混淆。 */}
						<MobileBrandLogoIcon className="h-9 w-9 shrink-0" />
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
							const isActive = activeView === key

							return (
								<button
									key={key}
									type="button"
									onClick={() => onNavigate(key)}
									data-testid={`${testIdPrefix}-nav-${key}`}
									className={navRowClass(isActive)}
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
							const isActive = activeView === key

							return (
								<button
									key={key}
									type="button"
									onClick={() => onNavigate(key)}
									data-testid={`${testIdPrefix}-nav-${key}`}
									className={navRowClass(isActive)}
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
								<div className="flex h-8 items-center px-2">
									<span className="truncate text-sm leading-5 text-muted-foreground">
										{t("mobile.shell.recentlyUsed")}
									</span>
								</div>
								{recentItems.map((item) => (
									<div
										key={item.id}
										className="flex h-9 items-center gap-1 rounded-lg"
									>
										<button
											type="button"
											// 最近项目需要直接进入目标项目，而不是统一回到首页。
											onClick={() => onRecentNavigate(item)}
											data-testid={`${testIdPrefix}-recent-${item.id}`}
											className="flex h-9 flex-1 items-center gap-2 rounded-lg px-2 text-left text-sm text-foreground transition-colors active:bg-black/5 dark:active:bg-white/10"
										>
											{/* 进行中状态：标题左侧展示旋转 Loader，与原型 Loader icon 对齐 */}
											{item.inProgress && (
												<Loader className="size-4 shrink-0 animate-spin text-foreground" />
											)}
											<div className="flex min-w-0 flex-1 items-center gap-2">
												<span className="truncate">{item.title}</span>
												{/* 徽章区：pinned > linked > shared，顺序与原型一致 */}
												{(item.isPinned ||
													item.isLinked ||
													item.isShared) && (
													<div className="flex shrink-0 items-center gap-1">
														{item.isPinned && <MobilePinBadge />}
														{item.isLinked && (
															<span className="flex items-center rounded-[6px] border border-border bg-muted p-[2px] text-muted-foreground">
																<LinkedBadgeIcon />
															</span>
														)}
														{item.isShared && (
															<span className="flex items-center rounded-[6px] border border-info/30 bg-info/10 p-[2px] text-info">
																<SharedBadgeIcon />
															</span>
														)}
													</div>
												)}
											</div>
										</button>
										<button
											type="button"
											disabled={!item.project}
											onClick={() => {
												if (!item.project) return
												openActionsPopup(item.project)
											}}
											data-testid={`${testIdPrefix}-recent-actions-${item.id}`}
											className={cn(
												"flex size-9 shrink-0 items-center justify-center rounded-lg text-foreground transition-colors active:bg-black/5 dark:active:bg-white/10",
												!item.project && "opacity-40",
											)}
											aria-label={t("common.more")}
										>
											<Ellipsis className="size-4" />
										</button>
									</div>
								))}
							</div>
						</>
					)}
				</div>
			</div>

			<div
				className="dark:border-white/12 flex shrink-0 items-center justify-between gap-2 px-3 pt-3"
				style={{ paddingBottom: "calc(var(--safe-area-inset-bottom, 0px) + 12px)" }}
			>
				<div className="flex min-w-0 items-center gap-2">
					<button
						type="button"
						title={displayName}
						onClick={openSettings}
						className={cn(
							"flex min-w-0 max-w-[140px] items-center gap-1.5 rounded-full bg-card py-1.5 pl-1.5 pr-2.5 text-left shadow-lg transition-opacity active:opacity-70",
							"dark:ring-white/12 dark:bg-black dark:shadow-none dark:ring-1",
						)}
						data-testid={`${testIdPrefix}-account-pill`}
					>
						{/* 账号入口优先展示真实头像，缺失时再回退到当前首字母占位，避免空头像状态影响识别。 */}
						{avatarUrl ? (
							<img
								src={avatarUrl}
								alt=""
								aria-hidden
								referrerPolicy="no-referrer"
								className="size-8 shrink-0 rounded-full object-cover"
							/>
						) : (
							<span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-medium text-foreground">
								{initial}
							</span>
						)}
						<span className="truncate text-sm font-medium leading-none text-foreground">
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
			{projectActionComponents}
		</div>
	)
})

/** 导出 memo 包装，避免壳层开关时无关重渲染扩散。 */
export default memo(MobileShellSidebarView)
