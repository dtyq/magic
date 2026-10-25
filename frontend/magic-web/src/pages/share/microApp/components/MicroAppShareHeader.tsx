import { Suspense, useCallback, useMemo, useState } from "react"
import { useTranslation } from "react-i18next"
import { Building2, ChevronDown, LogIn, LogOut, MonitorDown, ShieldCheck } from "lucide-react"
import MagicDropdown from "@/components/base/MagicDropdown"
import UserAvatarRender from "@/components/business/UserAvatarRender"
import { Button } from "@/components/shadcn-ui/button"
import { cn } from "@/utils/cn"
import OrganizationList from "@/layouts/BaseLayout/components/Sider/components/OrganizationSwitch/OrganizationList"
import { OrganizationSwitchPanel } from "@/layouts/BaseLayoutMobile/components/OrganizationSwitch"
import useLogout from "@/hooks/account/useLogout"
import { useIsMobile } from "@/hooks/useIsMobile"
import { useAuthorization, useOrganization, useUserInfo } from "@/models/user/hooks"
import GlobalSidebarStore from "@/stores/display/GlobalSidebarStore"
import { authEventBus } from "@/services/auth/AuthEventBus"
import { AuthEventName } from "@/services/auth/AuthEvents"

const transparentDropdownOverlayClassName =
	"!min-h-0 !min-w-0 !overflow-visible !rounded-none !border-0 !bg-transparent !p-0 !shadow-none !outline-none data-[state=open]:!animate-none data-[state=closed]:!animate-none"

const headerActionButtonClassName =
	"h-8 gap-1.5 rounded-full border-border/60 bg-background/80 px-2.5 shadow-sm sm:px-3"

const dropdownEnterClassName =
	"motion-reduce:animate-none animate-in fade-in-0 duration-200 fill-mode-both"

const userMenuEnterClassName = cn(dropdownEnterClassName, "slide-in-from-top-1")

const organizationPanelEnterClassName = cn(dropdownEnterClassName, "slide-in-from-right-1")

const menuItemClassName =
	"flex h-8 w-full items-center gap-1.5 rounded-md px-2 text-left text-[13px] font-medium transition-colors duration-150 ease-out active:scale-[0.98]"

const userMenuPanelClassName =
	"w-[220px] max-w-[calc(100vw-24px)] rounded-[10px] border border-border/60 bg-popover p-1 text-popover-foreground shadow-md"

function goLogin() {
	authEventBus.emit(AuthEventName.RequestLogin, {
		reason: "manual",
		source: "share",
		returnTo: window.location.href,
		preserveQuery: true,
	})
}

interface MicroAppShareHeaderProps {
	appName?: string
	showInstall: boolean
	showPermissionManager: boolean
	onInstall: () => void
	onOpenPermissionManager: () => void
}

export default function MicroAppShareHeader({
	appName,
	showInstall,
	showPermissionManager,
	onInstall,
	onOpenPermissionManager,
}: MicroAppShareHeaderProps) {
	const { t } = useTranslation("super")
	const { t: tInterface } = useTranslation("interface")
	const isMobile = useIsMobile()
	const { userInfo } = useUserInfo()
	const { authorization } = useAuthorization()
	const { organizations, organizationCode, teamshareOrganizationCode, magicOrganizationMap } =
		useOrganization()
	const [userMenuOpen, setUserMenuOpen] = useState(false)
	const [organizationMenuOpen, setOrganizationMenuOpen] = useState(false)
	const logout = useLogout({ onConfirm: () => setUserMenuOpen(false) })

	const isLoggedIn = Boolean(userInfo?.user_id || authorization?.trim())
	const displayName =
		userInfo?.real_name || userInfo?.nickname || userInfo?.magic_id || t("microAppShare.user")
	const organizationName = useMemo(() => {
		const teamshareOrganization = organizations.find(
			(item) => item.organization_code === teamshareOrganizationCode,
		)
		if (teamshareOrganization?.organization_name) return teamshareOrganization.organization_name

		const magicOrganization = organizationCode ? magicOrganizationMap[organizationCode] : null
		return (
			magicOrganization?.organization_name ||
			teamshareOrganizationCode ||
			organizationCode ||
			""
		)
	}, [magicOrganizationMap, organizationCode, organizations, teamshareOrganizationCode])

	const handleLogout = useCallback(() => {
		void logout()
	}, [logout])
	const handleOpenMobileOrganizationSwitch = useCallback(() => {
		GlobalSidebarStore.openOrganizationSwitch()
	}, [])
	const handleUserMenuOpenChange = useCallback((open: boolean) => {
		setUserMenuOpen(open)
		if (!open) setOrganizationMenuOpen(false)
	}, [])
	const handleOrganizationListClose = useCallback(() => {
		setOrganizationMenuOpen(false)
		setUserMenuOpen(false)
	}, [])

	const renderOrganizationList = () => (
		<Suspense fallback={null}>
			<div className={organizationPanelEnterClassName}>
				<OrganizationList onClose={handleOrganizationListClose} />
			</div>
		</Suspense>
	)
	const renderUserMenu = () => (
		<div
			className={cn(userMenuPanelClassName, userMenuEnterClassName)}
			data-testid="micro-app-share-user-menu"
		>
			<div className="flex flex-col gap-0.5">
				<MagicDropdown
					placement="leftTop"
					open={organizationMenuOpen}
					onOpenChange={setOrganizationMenuOpen}
					trigger={["click"]}
					popupRender={renderOrganizationList}
					overlayClassName={transparentDropdownOverlayClassName}
				>
					<button
						type="button"
						className={cn(
							menuItemClassName,
							"text-foreground hover:bg-muted/70",
							organizationMenuOpen && "bg-muted/50",
						)}
						data-testid="micro-app-share-organization-trigger"
					>
						<Building2 className="size-3.5 shrink-0 text-muted-foreground" />
						<span className="min-w-0 flex-1 truncate">
							{organizationName || t("microAppShare.organization")}
						</span>
						<ChevronDown
							className={cn(
								"size-3.5 shrink-0 text-muted-foreground transition-transform duration-200",
								organizationMenuOpen ? "rotate-0" : "-rotate-90",
							)}
						/>
					</button>
				</MagicDropdown>
				<button
					type="button"
					className={cn(menuItemClassName, "text-destructive hover:bg-destructive/10")}
					onClick={handleLogout}
					data-testid="micro-app-share-logout"
				>
					<LogOut className="size-3.5" />
					{tInterface("common.logout")}
				</button>
			</div>
		</div>
	)
	const userTrigger = (
		<button
			type="button"
			className={cn(
				"group flex h-9 max-w-[248px] items-center gap-2 rounded-full border border-border/50",
				"bg-muted/30 py-1 pl-1 pr-2.5 text-left shadow-sm transition-all duration-200 ease-out",
				"hover:border-border hover:bg-muted/60 hover:shadow-md",
				userMenuOpen && "border-border bg-muted/60 shadow-md",
			)}
			onClick={isMobile ? handleOpenMobileOrganizationSwitch : undefined}
			data-testid="micro-app-share-user-trigger"
		>
			<UserAvatarRender
				userInfo={userInfo}
				size={28}
				shape="circle"
				className="size-7 shrink-0 ring-2 ring-background"
			/>
			<div className="hidden min-w-0 flex-1 sm:block">
				<div className="truncate text-sm font-medium leading-5 text-foreground">
					{displayName}
				</div>
				{organizationName ? (
					<div className="truncate text-xs leading-4 text-muted-foreground">
						{organizationName}
					</div>
				) : null}
			</div>
			<ChevronDown
				className={cn(
					"mr-0.5 size-3.5 shrink-0 text-muted-foreground transition-transform duration-200",
					userMenuOpen && "rotate-180",
				)}
			/>
		</button>
	)

	const displayTitle = appName?.trim() || t("microAppShare.title")

	return (
		<>
			<header
				className={cn(
					"relative z-20 flex h-[52px] shrink-0 items-center justify-between gap-4",
					"border-b border-border/40 bg-background/75 px-4 backdrop-blur-xl",
					"supports-[backdrop-filter]:bg-background/60 sm:px-6",
				)}
				data-testid="micro-app-share-header"
			>
				<div className="flex min-w-0 items-center gap-2.5 sm:gap-3">
					<span
						aria-hidden
						className="hidden h-4 w-1 shrink-0 rounded-full bg-primary/70 sm:block"
					/>
					<h1 className="truncate text-sm font-semibold tracking-tight text-foreground sm:text-[15px]">
						{displayTitle}
					</h1>
				</div>
				<div className="flex shrink-0 items-center gap-1 sm:gap-1.5">
					{showInstall ? (
						<Button
							type="button"
							variant="outline"
							size="sm"
							className={headerActionButtonClassName}
							onClick={onInstall}
							aria-label={t("microAppShare.install")}
							data-testid="micro-app-share-install"
						>
							<MonitorDown size={15} />
							<span className="hidden sm:inline">{t("microAppShare.install")}</span>
						</Button>
					) : null}
					{showPermissionManager && isLoggedIn ? (
						<Button
							type="button"
							variant="outline"
							size="sm"
							className={headerActionButtonClassName}
							onClick={onOpenPermissionManager}
							title={t("htmlEditor.permissionManager.open")}
							data-testid="micro-app-share-permission-manager"
						>
							<ShieldCheck size={15} />
							<span className="hidden sm:inline">
								{t("htmlEditor.permissionManager.open")}
							</span>
						</Button>
					) : null}
					{isLoggedIn ? (
						<div data-testid="micro-app-share-user">
							{isMobile ? (
								userTrigger
							) : (
								<MagicDropdown
									placement="bottomRight"
									open={userMenuOpen}
									onOpenChange={handleUserMenuOpenChange}
									trigger={["click"]}
									popupRender={renderUserMenu}
									overlayClassName={transparentDropdownOverlayClassName}
								>
									{userTrigger}
								</MagicDropdown>
							)}
						</div>
					) : (
						<Button
							type="button"
							size="sm"
							className="h-8 gap-1.5 rounded-full px-3 shadow-sm"
							onClick={goLogin}
							data-testid="micro-app-share-login"
						>
							<LogIn size={15} />
							{t("microAppShare.login")}
						</Button>
					)}
				</div>
			</header>
			{isMobile ? <OrganizationSwitchPanel /> : null}
		</>
	)
}
