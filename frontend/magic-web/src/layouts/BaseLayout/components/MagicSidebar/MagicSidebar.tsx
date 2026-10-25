import { useCallback, useEffect, useRef, useState, lazy, Suspense } from "react"
import { observer } from "mobx-react-lite"
import { sidebarStore } from "@/stores/layout"
import { cn } from "@/utils/cn"
import {
	SidebarProvider,
	SidebarHeader as ShadcnSidebarHeader,
	SidebarContent as ShadcnSidebarContent,
	SidebarFooter as ShadcnSidebarFooter,
} from "@/components/shadcn-ui/sidebar"
import MagicSidebarHeader from "./SidebarHeader"
import MagicSidebarContent from "./SidebarContent"
import MagicSidebarFooter from "./SidebarFooter"
import { Sheet, SheetContent, SheetTitle } from "@/components/shadcn-ui/sheet"
import { useLocation } from "react-router-dom"
import { useTranslation } from "react-i18next"
import { userStore } from "@/models/user"

const NotificationCenterPanel = lazy(
	() => import("@/components/business/NotificationCenter/NotificationCenterPanel"),
)

const MagicSidebar = observer(
	({
		overlayMode = false,
		visible = true,
		onBusyChange,
	}: {
		overlayMode?: boolean
		visible?: boolean
		onBusyChange?: (busy: boolean) => void
	}) => {
		const { collapsed, setCollapsed } = sidebarStore
		const { t } = useTranslation("super")
		const { pathname } = useLocation()
		const [drawerOpen, setDrawerOpen] = useState(false)
		const [drawerPresent, setDrawerPresent] = useState(false)
		const [busy, setBusy] = useState(false)
		const [footerBusy, setFooterBusy] = useState(false)
		const [editing, setEditing] = useState(false)
		const interactionBusy = busy || footerBusy || editing
		const openedPath = useRef(pathname)
		const triggerRef = useRef<HTMLElement | null>(null)
		const ownedPointerEvent = useRef<Event | null>(null)
		const ownedFocusEvent = useRef<Event | null>(null)
		const focusFrame = useRef<number>()
		const openRef = useRef(drawerOpen)
		openRef.current = drawerOpen
		const closeDrawer = useCallback(() => setDrawerOpen(false), [])
		const userId = userStore.user.userInfo?.user_id
		const organizationCode = userStore.user.organizationCode
		useEffect(() => {
			onBusyChange?.(interactionBusy)
		}, [interactionBusy, onBusyChange])
		useEffect(
			() => () => {
				onBusyChange?.(false)
				if (focusFrame.current !== undefined) cancelAnimationFrame(focusFrame.current)
			},
			[onBusyChange],
		)
		useEffect(closeDrawer, [userId, organizationCode, closeDrawer])
		useEffect(() => {
			if (
				!visible ||
				(drawerOpen &&
					!interactionBusy &&
					(!overlayMode || pathname !== openedPath.current))
			)
				closeDrawer()
		}, [visible, drawerOpen, interactionBusy, overlayMode, pathname, closeDrawer])
		const handleOpenChange = (open: boolean) => {
			if (interactionBusy) return
			if (!open && drawerPresent) {
				closeDrawer()
				return
			}
			if (open && overlayMode) {
				triggerRef.current =
					document.activeElement instanceof HTMLElement ? document.activeElement : null
				openedPath.current = pathname
				setDrawerPresent(true)
				setDrawerOpen(true)
				return
			}
			setCollapsed(!open)
		}
		const contentCollapsed = drawerPresent ? false : collapsed
		const content = (
			<>
				<ShadcnSidebarContent
					className="min-h-0 flex-1 gap-0 overflow-hidden p-0"
					data-testid="sidebar-content"
				>
					<MagicSidebarContent
						collapsed={contentCollapsed}
						onBusyChange={setBusy}
						onSelect={closeDrawer}
					/>
				</ShadcnSidebarContent>
				<ShadcnSidebarFooter className="shrink-0 p-0" data-testid="sidebar-footer">
					<MagicSidebarFooter collapsed={contentCollapsed} onBusyChange={setFooterBusy} />
				</ShadcnSidebarFooter>
			</>
		)

		return (
			<SidebarProvider
				open={drawerPresent || !collapsed}
				onOpenChange={handleOpenChange}
				className="h-full min-h-0"
				data-testid="sidebar-provider"
				onPointerDownCapture={(event) => {
					ownedPointerEvent.current = event.nativeEvent
				}}
				onFocusCapture={(event) => {
					ownedFocusEvent.current = event.nativeEvent
					setEditing(event.target.matches("input, textarea, [contenteditable=true]"))
				}}
				onBlurCapture={() => setEditing(false)}
			>
				<div
					className={cn(
						"group/sidebar relative flex h-full w-full flex-col bg-sidebar",
						drawerPresent && "invisible",
					)}
					data-state={collapsed ? "collapsed" : "expanded"}
					data-collapsible={collapsed ? "icon" : ""}
					data-testid="sidebar"
				>
					<ShadcnSidebarHeader className="shrink-0 p-0" data-testid="sidebar-header">
						<MagicSidebarHeader
							collapsed={collapsed}
							onToggleCollapse={() => handleOpenChange(collapsed)}
						/>
					</ShadcnSidebarHeader>
					{/* 浮层到退场结束始终是唯一内容 owner，避免两份轮询、查询或业务弹窗。 */}
					{!drawerPresent && content}
				</div>
				<Sheet open={drawerOpen} onOpenChange={handleOpenChange} modal={false}>
					<SheetContent
						side="left"
						showClose={false}
						// 沿用旧抽屉的 999 层级：body Portal 子菜单为 1000，不能被侧栏或透明层挡住。
						zIndexManaged={false}
						overlayClassName="!z-[999] bg-transparent"
						className="!inset-y-0 !left-0 !z-[999] !h-full !w-[min(320px,100vw)] !max-w-none !gap-0 border-r p-0 motion-reduce:animate-none"
						aria-describedby={undefined}
						onInteractOutside={(event) => {
							// React Portal 仍属于同一侧栏；用原事件归属保留菜单／组织面板点击，不猜全局 DOM。
							if (
								interactionBusy ||
								event.detail.originalEvent === ownedPointerEvent.current ||
								event.detail.originalEvent === ownedFocusEvent.current
							)
								event.preventDefault()
						}}
						onEscapeKeyDown={(event) => {
							if (interactionBusy) event.preventDefault()
						}}
						onCloseAutoFocus={(event) => {
							event.preventDefault()
							if (openRef.current) return
							setDrawerPresent(false)
							focusFrame.current = requestAnimationFrame(() => {
								if (!openRef.current && triggerRef.current?.isConnected)
									triggerRef.current.focus()
							})
						}}
						data-testid="sidebar-workspace-drawer"
					>
						<SheetTitle className="sr-only">
							{t("projectNavigation.sidebarTitle")}
						</SheetTitle>
						<div
							className="group/sidebar flex h-full min-h-0 flex-col bg-sidebar"
							data-state="expanded"
							data-collapsible=""
						>
							<ShadcnSidebarHeader className="shrink-0 p-0">
								<MagicSidebarHeader
									collapsed={false}
									onToggleCollapse={() => handleOpenChange(false)}
								/>
							</ShadcnSidebarHeader>
							{drawerPresent && content}
						</div>
					</SheetContent>
				</Sheet>
				<Suspense fallback={null}>
					<NotificationCenterPanel />
				</Suspense>
			</SidebarProvider>
		)
	},
)

export default MagicSidebar
