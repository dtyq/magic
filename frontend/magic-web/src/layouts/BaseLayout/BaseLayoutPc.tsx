import { lazy, Suspense, useEffect, useRef, useState } from "react"
import { useMemoizedFn, useMount } from "ahooks"
import MemberCard from "@/components/business/MemberCard"
import MemberCardStore from "@/stores/display/MemberCardStore"
import { observer, Observer } from "mobx-react-lite"
import { history } from "@/routes/history"
import { getHomeURL } from "@/utils/redirect"
import { useKeepAlive } from "@/hooks/router/useKeepAlive"
import useMetaSet from "@/routes/hooks/useRoutesMetaSet"
import { MultiFolderUploadToast } from "@/components/global/MultiFolderUploadToast"
import {
	ResizablePanelGroup,
	ResizablePanel,
	ResizableHandle,
	ResizableCollapseFeedback,
	ResizeGrip,
	resizeGlowClassName,
} from "@/components/shadcn-ui/resizable"
import type { ImperativePanelHandle } from "react-resizable-panels"
import { sidebarStore } from "@/stores/layout"
import MagicSidebar from "./components/MagicSidebar"
import { cn } from "@/utils/cn"
import { useSidebarAnimation, useSidebarResponsive } from "./hooks"
import { globalShareManagementStore } from "@/pages/superMagic/components/ShareManagement/stores"
import { magic } from "@/enhance/magicElectron"
import LayoutModalContainer from "./components/LayoutModalContainer"
import MaintenanceNotice from "@/components/global/MaintenanceNotice"
import { useLocation } from "react-router-dom"
import { useMagicWidgetConfig } from "@/providers/MagicWidgetProvider"
import { resolveMagicWidgetCrewLayout } from "@/providers/MagicWidgetProvider/config"
import { useTranslation } from "react-i18next"
import { routesMatch } from "@/routes/history/helpers"
import { RouteName } from "@/routes/constants"

const isElectron = magic?.env?.isElectron?.()

const ElectronHeader = lazy(() => import("./components/ElectronHeader"))

const ShareManagementContainer = lazy(
	() => import("@/pages/superMagic/components/ShareManagement/ShareManagementContainer"),
)

const BaseLayoutPc = observer(() => {
	const { t } = useTranslation("super")
	useMetaSet()
	const { Content } = useKeepAlive()
	const sidebarPanelRef = useRef<ImperativePanelHandle>(null)
	const { search, pathname } = useLocation()
	const [sidebarBusy, setSidebarBusy] = useState(false)
	const routeName = routesMatch(pathname)?.route.name
	const projectPage =
		routeName === RouteName.SuperWorkspaceProjectState ||
		routeName === RouteName.SuperWorkspaceProjectTopicState ||
		routeName === RouteName.SuperChatProjectState ||
		routeName === RouteName.AiCanvasProjectState
	const { config: widgetConfig, embedContext } = useMagicWidgetConfig()
	const widgetLayout = resolveMagicWidgetCrewLayout({
		configuredLayout: embedContext ? widgetConfig.layout : undefined,
		// This component is mounted only for the desktop shell; explicit mobile uses BaseLayoutMobile.
		isMobileViewport: false,
		search,
	})
	const showAppSidebar =
		!embedContext || widgetLayout !== "desktop" || widgetConfig.shell?.appSidebar !== false

	// Cache initial width to avoid re-reading during drag
	const [initialWidth] = useState(() => sidebarStore.width)

	const {
		overlayMode,
		resizeDrag,
		isUserResizingRef,
		handleSidebarDragging,
		handleSidebarResize,
		handleSidebarResizeKeyDown,
		minSidebarSizePercent,
		getExpandedSidebarSizePercent,
	} = useSidebarResponsive({
		sidebarPanelRef,
		initialWidth,
		enabled: showAppSidebar,
		projectPage: projectPage && !embedContext,
		busy: sidebarBusy,
	})

	// Handle smooth sidebar animation and restore the responsive expanded width.
	const cancelSidebarAnimation = useSidebarAnimation({
		sidebarPanelRef,
		isUserResizingRef,
		getExpandedSidebarSizePercent,
	})

	const handleSidebarDraggingChange = useMemoizedFn((isDragging: boolean) => {
		if (isDragging) cancelSidebarAnimation()
		handleSidebarDragging(isDragging)
	})

	const handleSidebarHandleKeyDown = useMemoizedFn((event: React.KeyboardEvent<HTMLElement>) => {
		if (handleSidebarResizeKeyDown(event)) {
			cancelSidebarAnimation()
		}
	})

	useEffect(() => {
		const sidebarPanel = sidebarPanelRef.current
		if (!sidebarPanel) return
		cancelSidebarAnimation()
		if (!showAppSidebar) {
			// Resize imperatively so runtime configuration keeps the main content subtree mounted.
			sidebarPanel.resize(0)
			return
		}
		sidebarPanel.resize(
			sidebarStore.collapsed
				? sidebarStore.collapsedSizePercent
				: getExpandedSidebarSizePercent(window.innerWidth),
		)
	}, [cancelSidebarAnimation, getExpandedSidebarSizePercent, showAppSidebar])

	useMount(() => {
		if (window.location.pathname === "/") {
			getHomeURL().then(history.replace)
		}
	})

	const handleClick = useMemoizedFn((e: React.MouseEvent<HTMLDivElement>) => {
		const target = e.target as HTMLElement
		const memberCard = target.closest(`.${MemberCardStore.domClassName}`)

		if (memberCard) {
			const uid = MemberCardStore.getUidFromElement(memberCard as HTMLElement)
			if (uid) {
				MemberCardStore.openCard(uid, { x: e.clientX, y: e.clientY })
			}
			return
		}

		// 点击卡片外其他区域，关闭成员卡片
		if (MemberCardStore.open) {
			MemberCardStore.closeCard()
		}
	})

	return (
		<div
			className="flex h-full w-full flex-col bg-sidebar pb-safe-bottom pl-safe-left pr-safe-right pt-safe-top"
			data-testid="base-layout-pc-root"
			onClick={handleClick}
		>
			<MaintenanceNotice />
			{isElectron && (
				<Suspense fallback={null}>
					<ElectronHeader />
				</Suspense>
			)}
			<ResizablePanelGroup direction="horizontal" className="min-h-0 flex-1">
				{/* Sidebar Panel - always rendered with smooth width transition */}
				<Observer>
					{() => (
						<ResizablePanel
							ref={sidebarPanelRef}
							id="sidebar-panel"
							defaultSize={
								!showAppSidebar
									? 0
									: sidebarStore.collapsed || overlayMode
										? sidebarStore.collapsedSizePercent
										: initialWidth
							}
							maxSize={
								!showAppSidebar
									? 0
									: sidebarStore.collapsed || overlayMode
										? sidebarStore.collapsedSizePercent
										: sidebarStore.getMaxWidthPercent(sidebarStore.windowWidth)
							}
							minSize={
								!showAppSidebar
									? 0
									: sidebarStore.collapsed || overlayMode || resizeDrag.expanding
										? sidebarStore.collapsedSizePercent
										: minSidebarSizePercent
							}
							onResize={showAppSidebar ? handleSidebarResize : undefined}
						>
							<div
								className={cn(
									"h-full",
									!showAppSidebar && "pointer-events-none invisible",
								)}
								// 拖开时按正常最小宽度排内容，由面板裁切露出，避免窄尺寸挤压按钮与文字。
								style={
									resizeDrag.expanding
										? {
												minWidth: `${(minSidebarSizePercent / 100) * window.innerWidth}px`,
											}
										: undefined
								}
								aria-hidden={!showAppSidebar}
							>
								<MagicSidebar
									overlayMode={overlayMode}
									visible={showAppSidebar}
									onBusyChange={setSidebarBusy}
								/>
							</div>
						</ResizablePanel>
					)}
				</Observer>

				{/* 收起后仍保留同一把手，短拉可展开；原生拖动生命周期不随展示状态切断。 */}
				{/* 弹性提示需要显示在主内容上方；仅拖动期间提升手柄层级。 */}
				<Observer>
					{() => (
						<ResizableHandle
							disabled={!showAppSidebar || overlayMode || resizeDrag.cancelled}
							aria-label={t("sidebarPanels.resizeSidebar")}
							data-dragging={resizeDrag.dragging}
							onDragging={handleSidebarDraggingChange}
							onKeyDownCapture={handleSidebarHandleKeyDown}
							className={cn(
								// Overlay both panels and stay above the project page's z-20 collapsed divider and preview resize slots.
								"group/resize z-40 -mx-1 w-2 shrink-0 bg-transparent outline-none before:!inset-0 before:!w-full before:!translate-x-0 after:!inset-0 after:!w-full after:!translate-x-0 hover:!bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:before:opacity-100 dark:[--resize-glow-rgb:52,88,136]",
								resizeGlowClassName,
								resizeDrag.dragging && "before:opacity-100",
								resizeDrag.dragging && "z-50",
								!showAppSidebar || overlayMode
									? "pointer-events-none opacity-0"
									: "opacity-100 hover:bg-primary/30",
							)}
						>
							<ResizeGrip orientation="vertical" />
							<ResizableCollapseFeedback
								dragging={resizeDrag.dragging}
								collapseProgress={resizeDrag.progress}
								collapseArmed={resizeDrag.armed}
								collapseDirection={-1}
								pullLabel={t("sidebarPanels.pullLeftToCollapse")}
								description={
									resizeDrag.armed
										? t("sidebarPanels.pullRightToCancel")
										: t("sidebarPanels.releaseKeepsOpen")
								}
								releaseLabel={t("sidebarPanels.releaseToCollapse")}
							/>
						</ResizableHandle>
					)}
				</Observer>

				{/* Main Content Panel - "被包裹"效果 */}
				<ResizablePanel id="main-content-panel">
					{/* Keep the desktop floating gap only when the page is not embedded by Widget SDK. */}
					<div
						className={cn(
							"relative flex h-full flex-col",
							!embedContext && "py-2 pl-0 pr-2",
						)}
						data-testid="base-layout-pc-main-frame"
					>
						{/* 白色容器，带圆角、边框、阴影 */}
						<div className="flex h-full flex-col overflow-hidden">
							<main className="flex-1 overflow-hidden">{Content}</main>
						</div>
					</div>
				</ResizablePanel>
			</ResizablePanelGroup>

			{/* Existing modals */}
			<MemberCard />
			<LayoutModalContainer />
			{globalShareManagementStore.visible && (
				<Suspense fallback={null}>
					<ShareManagementContainer />
				</Suspense>
			)}
			{/* 全局文件夹上传进度组件 */}
			<MultiFolderUploadToast />
		</div>
	)
})

export default BaseLayoutPc
