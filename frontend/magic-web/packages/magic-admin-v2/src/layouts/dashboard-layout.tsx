import { ChevronRight, Menu, PanelLeft, PanelLeftClose, Sparkles, X } from "lucide-react"
import { useEffect, useMemo, useRef, useState } from "react"
import { NavLink, Outlet, useLocation, useResolvedPath } from "react-router-dom"
import {
	type NavigationGroup,
	type NavigationItem,
	type PrimaryNavigationItem,
	createNavigation,
	getDefaultNavigationHref,
} from "@magic-admin-v2/routes/menu"
import { LanguageSwitcher } from "@magic-admin-v2/components/language-switcher"
import { ThemeSwitcher } from "@magic-admin-v2/components/theme-switcher"
import { Button } from "@magic-admin-v2/components/ui/button"
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSub,
	DropdownMenuSubContent,
	DropdownMenuSubTrigger,
	DropdownMenuTrigger,
} from "@magic-admin-v2/components/ui/dropdown-menu"
import { Skeleton } from "@magic-admin-v2/components/ui/skeleton"
import { usePlatformInfoQuery } from "@magic-admin-v2/features/platform-info/queries"
import { ShellAccountControls } from "@magic-admin-v2/layouts/components/shell-account-controls"
import type {
	PlatformInfoDetails,
	PlatformLocale,
	PlatformLocalizedText,
} from "@magic-admin-v2/features/platform-info/types"
import { useTranslation } from "react-i18next"
import { useI18n } from "@magic-admin-v2/i18n/use-i18n"
import { Language, type Language as LanguageCode } from "@magic-admin-v2/i18n/resources"
import { useAppShellStore } from "@magic-admin-v2/store/app-shell-store"
import { useRouteConfig } from "@magic-admin-v2/routes/context"
import { useRuntime } from "@magic-admin-v2/runtime/context"
import { cn } from "@magic-admin-v2/utils/cn"

const fallbackBrandInitial = "M"

export default function DashboardLayout() {
	const { t } = useTranslation()
	const { language } = useI18n()
	const location = useLocation()
	const routeBasePath = useResolvedPath(".").pathname
	const routes = useRouteConfig()
	const { access, organization } = useRuntime()
	const platformInfoQuery = usePlatformInfoQuery()
	const isBrandLoading = !platformInfoQuery.data && platformInfoQuery.isLoading
	const platformBrand = useMemo(
		() =>
			getPlatformBrand(
				platformInfoQuery.data,
				language,
				t("app.name"),
				isBrandLoading,
				organization.current.logo,
			),
		[isBrandLoading, language, organization.current.logo, platformInfoQuery.data, t],
	)
	const navigation = useMemo(
		() => createNavigation(routes, access, routeBasePath),
		[access, routeBasePath, routes],
	)
	const defaultHref = getDefaultNavigationHref(navigation) ?? routeBasePath
	const {
		isSidebarCollapsed,
		isMobileSidebarOpen,
		setMobileSidebarOpen,
		toggleMobileSidebar,
		toggleSidebar,
	} = useAppShellStore()
	const [isMobileSidebarMounted, setIsMobileSidebarMounted] = useState(false)
	const [isMobileSidebarEntered, setIsMobileSidebarEntered] = useState(false)

	useEffect(() => {
		let closeTimer: number | undefined
		let enterFrame: number | undefined

		if (isMobileSidebarOpen) {
			setIsMobileSidebarMounted(true)
			enterFrame = window.requestAnimationFrame(() => setIsMobileSidebarEntered(true))
		} else {
			setIsMobileSidebarEntered(false)
			closeTimer = window.setTimeout(() => setIsMobileSidebarMounted(false), 300)
		}

		return () => {
			if (enterFrame !== undefined) window.cancelAnimationFrame(enterFrame)
			if (closeTimer !== undefined) window.clearTimeout(closeTimer)
		}
	}, [isMobileSidebarOpen])

	useEffect(() => {
		if (!platformBrand.isLoading && platformBrand.name) {
			document.title = platformBrand.name
		}
	}, [platformBrand.isLoading, platformBrand.name])

	useEffect(() => {
		if (!platformBrand.isLoading && platformBrand.favicon) {
			setDocumentFavicon(platformBrand.favicon)
		}
	}, [platformBrand.favicon, platformBrand.isLoading])

	useEffect(() => {
		function handleKeyDown(event: KeyboardEvent) {
			if (event.key.toLowerCase() === "b" && (event.metaKey || event.ctrlKey)) {
				event.preventDefault()
				toggleSidebar()
			}
		}

		window.addEventListener("keydown", handleKeyDown)
		return () => window.removeEventListener("keydown", handleKeyDown)
	}, [toggleSidebar])

	return (
		<div
			className="flex h-svh min-h-0 w-full overflow-hidden bg-background text-foreground"
			data-testid="dashboard-layout"
		>
			<aside
				className={cn(
					"fixed inset-y-0 left-0 z-40 hidden border-r border-sidebar-border bg-sidebar text-sidebar-foreground transition-[width] duration-200 ease-linear lg:flex",
					isSidebarCollapsed ? "w-12" : "w-64",
				)}
				data-testid="dashboard-sidebar"
			>
				<AppSidebar
					activePathname={location.pathname}
					brand={platformBrand}
					homeHref={defaultHref}
					isCollapsed={isSidebarCollapsed}
					navigation={navigation}
					onToggleSidebar={toggleSidebar}
				/>
			</aside>

			{isMobileSidebarMounted ? (
				<div
					className={cn(
						"fixed inset-0 z-[60] isolate lg:hidden",
						!isMobileSidebarEntered && "pointer-events-none",
					)}
					data-testid="dashboard-mobile-sidebar"
				>
					<button
						aria-label={t("aria.closeNavigationOverlay")}
						data-testid="dashboard-mobile-menu-button"
						className={cn(
							"absolute inset-0 z-0 bg-black/50 transition-opacity duration-300 ease-out motion-reduce:transition-none",
							isMobileSidebarEntered ? "opacity-100" : "opacity-0",
						)}
						onClick={() => setMobileSidebarOpen(false)}
						type="button"
					/>
					<aside
						className={cn(
							"relative z-10 flex h-full w-[18rem] transform bg-sidebar text-sidebar-foreground shadow-xl transition-transform duration-300 ease-out motion-reduce:transition-none",
							isMobileSidebarEntered ? "translate-x-0" : "-translate-x-full",
						)}
					>
						<AppSidebar
							activePathname={location.pathname}
							brand={platformBrand}
							homeHref={defaultHref}
							isCollapsed={false}
							navigation={navigation}
							onCloseMobile={() => setMobileSidebarOpen(false)}
						/>
					</aside>
				</div>
			) : null}

			<div
				className={cn(
					"flex h-full min-h-0 min-w-0 flex-1 flex-col transition-[padding] duration-200 ease-linear",
					isSidebarCollapsed ? "lg:pl-12" : "lg:pl-64",
				)}
			>
				<header className="sticky top-0 z-50 flex h-16 shrink-0 items-center gap-2 border-b border-border/50 bg-background/80 px-4 backdrop-blur-xl">
					<Button
						aria-label={t("aria.openNavigation")}
						data-testid="dashboard-open-navigation-button"
						className="-ml-1 text-muted-foreground transition-colors hover:text-foreground lg:hidden"
						onClick={toggleMobileSidebar}
						size="icon-sm"
						variant="ghost"
					>
						<Menu className="size-4" aria-hidden="true" />
					</Button>
					<Button
						aria-label={
							isSidebarCollapsed ? t("aria.expandSidebar") : t("aria.collapseSidebar")
						}
						data-testid="dashboard-toggle-sidebar-button"
						className="-ml-1 hidden text-muted-foreground transition-colors hover:text-foreground lg:inline-flex"
						onClick={toggleSidebar}
						size="icon-sm"
						variant="ghost"
					>
						<PanelLeft className="size-4" aria-hidden="true" />
					</Button>

					{/* <div className="mx-2 h-6 w-px bg-border/50" aria-hidden="true" /> */}

					{/* <button
            className="relative inline-flex h-8 items-center justify-start gap-2 rounded-md border border-input bg-background px-3 text-sm font-medium text-muted-foreground shadow-sm transition-colors hover:bg-accent hover:text-accent-foreground sm:pr-12 md:w-36 lg:w-56"
            onClick={() => toast.message(t("common.modulePending"))}
            type="button"
          >
            <Search className="size-4" aria-hidden="true" />
            <span>{t("appMenu.action.search")}</span>
            <kbd className="pointer-events-none absolute right-1.5 top-1/2 hidden h-5 -translate-y-1/2 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium sm:flex">
              <span className="text-xs">⌘</span>K
            </kbd>
          </button> */}

					<div className="ml-auto flex items-center gap-2">
						<LanguageSwitcher />
						<ThemeSwitcher />
						<ShellAccountControls />
					</div>
				</header>

				<main
					data-testid="dashboard-main-content"
					className="dashboard-scroll flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto overscroll-contain p-4 pt-0"
				>
					<div className="@container/main min-w-0 px-4 py-4 lg:px-6">
						<Outlet />
					</div>
				</main>
			</div>
		</div>
	)
}

type AppSidebarProps = {
	activePathname: string
	brand: PlatformBrand
	homeHref: string
	isCollapsed: boolean
	navigation: PrimaryNavigationItem[]
	onToggleSidebar?: () => void
	onCloseMobile?: () => void
}

function AppSidebar({
	activePathname,
	brand,
	homeHref,
	isCollapsed,
	navigation,
	onToggleSidebar,
	onCloseMobile,
}: AppSidebarProps) {
	const { t } = useTranslation()

	return (
		<div className="flex min-h-0 w-full flex-col overflow-hidden">
			<div className="flex flex-col gap-2 p-2">
				<div className="flex items-center gap-2">
					<BrandMark brand={brand} href={homeHref} isCollapsed={isCollapsed} />
					{onCloseMobile ? (
						<Button
							aria-label={t("aria.closeNavigation")}
							className="ml-auto text-muted-foreground"
							onClick={onCloseMobile}
							size="icon-sm"
							variant="ghost"
						>
							<X className="size-4" aria-hidden="true" />
						</Button>
					) : null}
				</div>
			</div>

			<nav
				aria-label={t("aria.primaryNavigation")}
				className={cn(
					"dashboard-scroll flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto overflow-x-hidden",
					isCollapsed && "items-center px-1.5 py-2",
				)}
				data-testid={
					isCollapsed
						? "dashboard-sidebar-navigation-collapsed"
						: "dashboard-sidebar-navigation"
				}
			>
				{isCollapsed
					? navigation.map((section) => (
							<CollapsedPrimaryNavigation
								activePathname={activePathname}
								key={section.id}
								onCloseMobile={onCloseMobile}
								section={section}
							/>
						))
					: navigation.map((section) => (
							<div
								className="relative flex w-full min-w-0 flex-col p-2"
								key={section.id}
							>
								<div className="flex h-8 shrink-0 items-center rounded-md px-2 text-xs font-medium uppercase tracking-wider text-muted-foreground/70">
									{t(section.titleKey)}
								</div>
								<div className="flex w-full min-w-0 flex-col gap-2">
									{section.groups.map((group) => (
										<SidebarNavigationGroup
											activePathname={activePathname}
											group={group}
											key={group.titleKey}
											onCloseMobile={onCloseMobile}
										/>
									))}
								</div>
							</div>
						))}
			</nav>

			{onToggleSidebar ? (
				<div className="flex flex-col gap-2 border-t border-sidebar-border p-2">
					<Button
						aria-label={
							isCollapsed ? t("aria.expandSidebar") : t("aria.collapseSidebar")
						}
						className={cn(
							"h-8 justify-start text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
							isCollapsed && "justify-center px-0",
						)}
						data-testid="dashboard-access-button"
						onClick={onToggleSidebar}
						variant="ghost"
					>
						{isCollapsed ? (
							<ChevronRight className="size-4" aria-hidden="true" />
						) : (
							<PanelLeftClose className="size-4" aria-hidden="true" />
						)}
						{!isCollapsed ? <span>{t("sidebar.collapse")}</span> : null}
					</Button>
				</div>
			) : null}
		</div>
	)
}

type SidebarNavigationGroupProps = {
	activePathname: string
	group: NavigationGroup
	onCloseMobile?: () => void
}

// Limit hover animation to colors so host link outline resets cannot animate a temporary border.
const sidebarNavigationInteraction =
	"outline-none ring-sidebar-ring transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-2"

type CollapsedPrimaryNavigationProps = {
	activePathname: string
	section: PrimaryNavigationItem
	onCloseMobile?: () => void
}

function CollapsedPrimaryNavigation({
	activePathname,
	section,
	onCloseMobile,
}: CollapsedPrimaryNavigationProps) {
	const { t } = useTranslation()
	const SectionIcon = section.icon
	const menuScope = `collapsed-nav-${section.id}`
	const [isMenuOpen, setIsMenuOpen] = useState(false)
	const isHoveringMenuRef = useRef(false)
	const closeTimerRef = useRef<number | null>(null)
	const pointerPositionRef = useRef({ x: 0, y: 0 })
	const isActive = section.groups.some(
		(group) =>
			group.href === activePathname ||
			group.items.some((item) => item.href === activePathname),
	)

	function trackPointerPosition(event: { clientX: number; clientY: number }) {
		pointerPositionRef.current = {
			x: event.clientX,
			y: event.clientY,
		}
	}

	function isPointerInsideMenuScope() {
		const target = document.elementFromPoint(
			pointerPositionRef.current.x,
			pointerPositionRef.current.y,
		)

		return Boolean(target?.closest(`[data-collapsed-nav-menu="${menuScope}"]`))
	}

	function clearCloseTimer() {
		if (closeTimerRef.current) {
			window.clearTimeout(closeTimerRef.current)
			closeTimerRef.current = null
		}
	}

	function openMenu(event?: { clientX: number; clientY: number }) {
		if (event) {
			trackPointerPosition(event)
		}
		isHoveringMenuRef.current = true
		clearCloseTimer()
		setIsMenuOpen(true)
	}

	function scheduleCloseMenu(event?: { clientX: number; clientY: number }) {
		if (event) {
			trackPointerPosition(event)
		}
		isHoveringMenuRef.current = false
		clearCloseTimer()
		closeTimerRef.current = window.setTimeout(() => {
			if (isPointerInsideMenuScope()) {
				isHoveringMenuRef.current = true
				return
			}

			if (!isHoveringMenuRef.current) {
				setIsMenuOpen(false)
			}
		}, 220)
	}

	function handleMenuOpenChange(open: boolean) {
		if (open) {
			openMenu()
			return
		}

		if (isHoveringMenuRef.current || isPointerInsideMenuScope()) {
			clearCloseTimer()
			return
		}

		scheduleCloseMenu()
	}

	useEffect(() => clearCloseTimer, [])

	return (
		<DropdownMenu modal={false} onOpenChange={handleMenuOpenChange} open={isMenuOpen}>
			<DropdownMenuTrigger asChild data-testid={section.testId}>
				<Button
					aria-label={t(section.titleKey)}
					className={cn(
						"size-8 shrink-0 px-0 text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
						isActive && "bg-sidebar-accent text-sidebar-accent-foreground",
					)}
					data-collapsed-nav-menu={menuScope}
					data-testid={section.testId}
					onPointerEnter={openMenu}
					onPointerLeave={scheduleCloseMenu}
					onPointerMove={trackPointerPosition}
					size="icon-sm"
					title={t(section.titleKey)}
					variant="ghost"
				>
					<SectionIcon className="size-4" aria-hidden="true" />
				</Button>
			</DropdownMenuTrigger>
			<DropdownMenuContent
				align="start"
				className="w-60 p-2"
				data-collapsed-nav-menu={menuScope}
				data-testid={`${section.testId}-content`}
				onPointerEnter={openMenu}
				onPointerLeave={scheduleCloseMenu}
				onPointerMove={trackPointerPosition}
				side="right"
				sideOffset={4}
			>
				<div className="mb-1 px-2 py-1 text-xs font-medium text-muted-foreground">
					<span className="truncate">{t(section.titleKey)}</span>
				</div>
				<div className="flex flex-col gap-1">
					{section.groups.map((group) => (
						<CollapsedNavigationGroupMenu
							activePathname={activePathname}
							group={group}
							key={group.titleKey}
							menuScope={menuScope}
							onKeepRootMenuOpen={openMenu}
							onCloseMobile={onCloseMobile}
							onScheduleRootMenuClose={scheduleCloseMenu}
							onTrackPointer={trackPointerPosition}
						/>
					))}
				</div>
			</DropdownMenuContent>
		</DropdownMenu>
	)
}

function CollapsedNavigationGroupMenu({
	activePathname,
	group,
	menuScope,
	onKeepRootMenuOpen,
	onCloseMobile,
	onScheduleRootMenuClose,
	onTrackPointer,
}: SidebarNavigationGroupProps & {
	menuScope: string
	onKeepRootMenuOpen: () => void
	onScheduleRootMenuClose: (event?: { clientX: number; clientY: number }) => void
	onTrackPointer: (event: { clientX: number; clientY: number }) => void
}) {
	const { t } = useTranslation()
	const GroupIcon = group.icon
	const isActive =
		group.href === activePathname || group.items.some((item) => item.href === activePathname)

	if (group.href && group.items.length === 0) {
		return (
			<DropdownMenuItem asChild className="p-0" data-testid={group.testId}>
				<NavLink
					className={({ isActive: isLinkActive }) =>
						cn(
							"flex h-8 min-w-0 items-center gap-2 rounded-md px-2 text-sm font-medium text-popover-foreground outline-none transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:bg-accent",
							isLinkActive && "bg-accent text-accent-foreground",
						)
					}
					data-testid={group.testId}
					onClick={onCloseMobile}
					to={group.href}
				>
					<GroupIcon
						className="size-4 shrink-0 text-muted-foreground"
						aria-hidden="true"
					/>
					<span className="truncate">{t(group.titleKey)}</span>
				</NavLink>
			</DropdownMenuItem>
		)
	}

	return (
		<DropdownMenuSub>
			<DropdownMenuSubTrigger
				className={cn(
					"h-8 cursor-default rounded-md px-2 text-sm font-medium text-popover-foreground hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground data-[state=open]:bg-accent data-[state=open]:text-accent-foreground",
					isActive && "bg-accent text-accent-foreground",
				)}
				data-testid={group.testId}
			>
				<GroupIcon
					className="mr-2 size-4 shrink-0 text-muted-foreground"
					aria-hidden="true"
				/>
				<span className="min-w-0 flex-1 truncate">{t(group.titleKey)}</span>
			</DropdownMenuSubTrigger>
			<DropdownMenuSubContent
				alignOffset={-4}
				className="w-60 p-2"
				data-collapsed-nav-menu={menuScope}
				data-testid={`${group.testId}-content`}
				onPointerEnter={onKeepRootMenuOpen}
				onPointerLeave={onScheduleRootMenuClose}
				onPointerMove={onTrackPointer}
				sideOffset={4}
			>
				<div className="mb-1 px-2 py-1 text-xs font-medium text-muted-foreground">
					<span className="truncate">{t(group.titleKey)}</span>
				</div>
				<div className="flex min-w-0 flex-col gap-1">
					{group.items.map((item) => {
						const ItemIcon = item.icon

						return (
							<DropdownMenuItem asChild className="p-0" key={item.href}>
								<NavLink
									className={({ isActive: isLinkActive }) =>
										cn(
											"flex h-8 min-w-0 items-center gap-2 rounded-md px-2 text-sm font-medium text-popover-foreground outline-none transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:bg-accent",
											isLinkActive && "bg-accent text-accent-foreground",
										)
									}
									data-testid={item.testId}
									onClick={onCloseMobile}
									to={item.href}
								>
									<ItemIcon
										className="size-4 shrink-0 text-muted-foreground"
										aria-hidden="true"
									/>
									<span className="truncate">{t(item.titleKey)}</span>
								</NavLink>
							</DropdownMenuItem>
						)
					})}
				</div>
			</DropdownMenuSubContent>
		</DropdownMenuSub>
	)
}

function SidebarNavigationGroup({
	activePathname,
	group,
	onCloseMobile,
}: SidebarNavigationGroupProps) {
	const { t } = useTranslation()
	const isActive =
		group.href === activePathname || group.items.some((item) => item.href === activePathname)
	const GroupIcon = group.icon
	const [isOpen, setIsOpen] = useState(isActive)

	useEffect(() => {
		if (isActive) {
			setIsOpen(true)
		}
	}, [isActive])

	if (group.href && group.items.length === 0) {
		return (
			<NavLink
				className={cn(
					"flex h-8 w-full min-w-0 items-center gap-2 rounded-md px-2 text-left text-sm font-medium text-sidebar-foreground",
					sidebarNavigationInteraction,
					isActive && "bg-sidebar-accent text-sidebar-accent-foreground",
				)}
				data-testid={group.testId}
				onClick={onCloseMobile}
				to={group.href}
			>
				<GroupIcon
					className={cn(
						"size-4 shrink-0 transition-colors",
						isActive ? "text-sidebar-accent-foreground" : "text-muted-foreground",
					)}
					aria-hidden="true"
				/>
				<span className="min-w-0 flex-1 truncate">{t(group.titleKey)}</span>
			</NavLink>
		)
	}

	return (
		<div
			className="group/collapsible flex min-w-0 flex-col gap-1"
			data-state={isOpen ? "open" : "closed"}
		>
			<button
				aria-expanded={isOpen}
				className={cn(
					"flex h-8 w-full min-w-0 items-center gap-2 rounded-md px-2 text-left text-sm font-medium text-sidebar-foreground",
					sidebarNavigationInteraction,
					isActive && "text-sidebar-accent-foreground",
				)}
				data-testid={group.testId}
				onClick={() => setIsOpen((current) => !current)}
				type="button"
			>
				<GroupIcon
					className={cn(
						"size-4 shrink-0 transition-colors",
						isActive ? "text-sidebar-accent-foreground" : "text-muted-foreground",
					)}
					aria-hidden="true"
				/>
				<span className="min-w-0 flex-1 truncate">{t(group.titleKey)}</span>
				<ChevronRight
					className="size-4 shrink-0 text-muted-foreground transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90"
					aria-hidden="true"
				/>
			</button>
			{isOpen ? (
				// Auto width leaves room for the left margin instead of overflowing the sidebar.
				<ul
					className="ml-3.5 flex min-w-0 flex-col gap-1 border-l border-sidebar-border pl-2"
					data-state="open"
				>
					{group.items.map((item) => (
						<SidebarMenuLink
							activePathname={activePathname}
							item={item}
							key={item.href}
							onCloseMobile={onCloseMobile}
						/>
					))}
				</ul>
			) : null}
		</div>
	)
}

type SidebarMenuLinkProps = {
	activePathname: string
	item: NavigationItem
	onCloseMobile?: () => void
}

function SidebarMenuLink({ activePathname, item, onCloseMobile }: SidebarMenuLinkProps) {
	const { t } = useTranslation()
	const isActive = activePathname === item.href

	return (
		<li className="group/menu-item relative min-w-0">
			<NavLink
				className={cn(
					"peer/menu-button relative flex h-8 w-full min-w-0 items-center gap-2 overflow-hidden rounded-md p-2 pl-4 text-left text-sm font-medium text-sidebar-foreground",
					sidebarNavigationInteraction,
					isActive && "bg-sidebar-accent text-sidebar-accent-foreground",
				)}
				data-testid={item.testId}
				onClick={onCloseMobile}
				to={item.href}
			>
				<item.icon
					className={cn(
						"size-4 shrink-0 transition-colors",
						isActive ? "text-sidebar-accent-foreground" : "text-muted-foreground",
					)}
					aria-hidden="true"
				/>
				<span className="min-w-0 truncate">{t(item.titleKey)}</span>
			</NavLink>
		</li>
	)
}

type BrandMarkProps = {
	brand: PlatformBrand
	href: string
	isCollapsed?: boolean
}

function BrandMark({ brand, href, isCollapsed = false }: BrandMarkProps) {
	const { t } = useTranslation()

	return (
		<NavLink
			aria-label={
				brand.isLoading ? t("nav.item.overview") : `${brand.name} ${t("nav.item.overview")}`
			}
			className={cn(
				"group/team relative flex min-w-0 flex-1 items-center gap-2 overflow-hidden rounded-md p-2 text-left text-sm outline-none ring-sidebar-ring transition-colors hover:bg-sidebar-accent focus-visible:ring-2",
				isCollapsed && "justify-center px-0",
			)}
			data-testid="dashboard-brand-link"
			to={href}
		>
			{brand.isLoading && !brand.logoUrl ? (
				<BrandLogoPlaceholder isCollapsed={isCollapsed} />
			) : (
				<BrandLogo
					isCollapsed={isCollapsed}
					logoUrl={brand.logoUrl}
					name={brand.isLoading ? "" : brand.name}
				/>
			)}
			{!isCollapsed ? (
				<div className="grid min-w-0 flex-1 text-left text-sm leading-tight">
					{brand.isLoading ? (
						<BrandTextSkeleton />
					) : (
						<>
							<span className="truncate font-semibold text-sidebar-foreground">
								{brand.name}
							</span>
							<span className="truncate text-xs text-muted-foreground">
								{t("app.subtitle")}
							</span>
						</>
					)}
				</div>
			) : null}
		</NavLink>
	)
}

type PlatformBrand = {
	name: string
	logoUrl: string
	favicon: string
	isLoading: boolean
}

function BrandLogoPlaceholder({ isCollapsed }: { isCollapsed: boolean }) {
	return (
		<span
			aria-hidden="true"
			className={cn(
				"flex shrink-0 items-center justify-center rounded-lg",
				isCollapsed ? "size-8" : "size-10",
			)}
		>
			<Skeleton className="size-full rounded-lg" />
		</span>
	)
}

function BrandTextSkeleton() {
	return (
		<span aria-hidden="true" className="block space-y-1.5">
			<Skeleton className="h-4 w-24" />
			<Skeleton className="h-3 w-14" />
		</span>
	)
}

function BrandLogo({
	isCollapsed,
	logoUrl,
	name,
}: {
	isCollapsed: boolean
	logoUrl: string
	name: string
}) {
	const [hasImageError, setHasImageError] = useState(false)

	useEffect(() => {
		setHasImageError(false)
	}, [logoUrl])

	if (isSafeImageUrl(logoUrl) && !hasImageError) {
		return (
			<span
				className={cn(
					"flex aspect-square shrink-0 items-center justify-center overflow-hidden rounded-lg border border-sidebar-border bg-background shadow-sm",
					isCollapsed ? "size-8" : "size-10",
				)}
			>
				<img
					alt=""
					className={cn(
						"object-contain",
						isCollapsed ? "max-h-7 max-w-7" : "max-h-9 max-w-9",
					)}
					draggable={false}
					onError={() => setHasImageError(true)}
					src={logoUrl}
				/>
			</span>
		)
	}

	return (
		<span
			aria-hidden="true"
			className={cn(
				"relative flex aspect-square shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-violet-500 to-fuchsia-500 text-sm font-semibold text-white shadow-md shadow-violet-500/20 transition-transform group-hover/team:scale-105",
				isCollapsed ? "size-8" : "size-10",
			)}
		>
			<Sparkles className="absolute size-4 opacity-20" />
			<span className="relative">{getBrandInitial(name)}</span>
		</span>
	)
}

function getPlatformBrand(
	platformInfo: PlatformInfoDetails | undefined,
	language: LanguageCode,
	fallbackName: string,
	isLoading: boolean,
	organizationLogo?: string,
): PlatformBrand {
	const organizationLogoUrl = organizationLogo?.trim() || ""

	if (isLoading) {
		return {
			name: "",
			logoUrl: organizationLogoUrl,
			favicon: organizationLogoUrl,
			isLoading: true,
		}
	}

	const locale = toPlatformLocale(language)
	const fallbackLocale = normalizePlatformLocale(platformInfo?.default_language)
	const name = getLocalizedValue(platformInfo?.name_i18n, locale, fallbackLocale) || fallbackName
	const platformLogoUrl =
		platformInfo?.minimal_logo ||
		getLocalizedValue(platformInfo?.logo, locale, fallbackLocale) ||
		""
	const logoUrl = organizationLogoUrl || platformLogoUrl
	const favicon =
		organizationLogoUrl || platformInfo?.favicon || platformLogoUrl || ""

	return {
		name,
		logoUrl,
		favicon,
		isLoading: false,
	}
}

function getLocalizedValue(
	value: PlatformLocalizedText | undefined,
	locale: PlatformLocale,
	fallbackLocale: PlatformLocale,
) {
	return (
		value?.[locale]?.trim() ||
		value?.[fallbackLocale]?.trim() ||
		value?.zh_CN ||
		value?.en_US ||
		""
	)
}

function toPlatformLocale(language: LanguageCode): PlatformLocale {
	return language === Language.EnUS ? Language.EnUS : Language.ZhCN
}

function normalizePlatformLocale(locale: PlatformInfoDetails["default_language"] | undefined) {
	return locale === Language.EnUS ? Language.EnUS : Language.ZhCN
}

function getBrandInitial(name: string) {
	return name.trim().charAt(0).toUpperCase() || fallbackBrandInitial
}

function isSafeImageUrl(value: string) {
	return /^https?:\/\//i.test(value)
}

function setDocumentFavicon(faviconUrl: string) {
	if (!isSafeImageUrl(faviconUrl)) {
		return
	}

	const selector = "link[rel='icon']"
	let link = document.head.querySelector<HTMLLinkElement>(selector)

	if (!link) {
		link = document.createElement("link")
		link.rel = "icon"
		document.head.appendChild(link)
	}

	link.href = faviconUrl
}
