import { lazy, Suspense, useRef, useState } from "react"
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
} from "@/components/shadcn-ui/resizable"
import type { ImperativePanelHandle } from "react-resizable-panels"
import { sidebarStore } from "@/stores/layout"
import MagicSidebar from "./components/MagicSidebar"
import { cn } from "@/lib/utils"
import { initializeSuperMagicIfNeeded } from "@/pages/superMagic/services/utils"
import { useSidebarAnimation, useSidebarResponsive } from "./hooks"
import { globalShareManagementStore } from "@/pages/superMagic/components/ShareManagement/stores"
import { magic } from "@/enhance/magicElectron"
import LayoutModalContainer from "./components/LayoutModalContainer"

const isElectron = magic?.env?.isElectron?.()

const ElectronHeader = lazy(() => import("./components/ElectronHeader"))

const ShareManagementContainer = lazy(
	() =>
		import("@/pages/superMagic/components/ShareManagement/ShareManagementContainer"),
)

function getSuperRouteParams(pathname: string): {
	workspaceId?: string
	projectId?: string
	topicId?: string
} {
	const pathParts = pathname.split("/").filter(Boolean)
	const superIndex = pathParts.indexOf("super")
	if (superIndex === -1) return {}
	return {
		workspaceId: undefined,
		projectId: pathParts[superIndex + 1] || undefined,
		topicId: pathParts[superIndex + 2] || undefined,
	}
}

const BaseLayoutPc = observer(() => {
	useMetaSet()
	const { Content } = useKeepAlive()
	const sidebarPanelRef = useRef<ImperativePanelHandle>(null)

	// Cache initial width to avoid re-reading during drag
	const [initialWidth] = useState(() => sidebarStore.width)

	// Handle smooth sidebar animation
	useSidebarAnimation(sidebarPanelRef)
	const { handleSidebarResize } = useSidebarResponsive({
		sidebarPanelRef,
		initialWidth,
	})

	useMount(() => {
		if (window.location.pathname === "/") {
			getHomeURL().then(history.replace)
		}
	})

	const handleClick = useMemoizedFn((e: React.MouseEvent<HTMLDivElement>) => {
		const target = e.target as HTMLElement
		if (target.closest(`.${MemberCardStore.domClassName}`)) {
			const memberCard = target.closest(`.${MemberCardStore.domClassName}`)
			const uid = MemberCardStore.getUidFromElement(memberCard as HTMLElement)
			if (uid) {
				MemberCardStore.openCard(uid, { x: e.clientX, y: e.clientY })
			}
		}
		// 点击卡片外其他区域，关闭成员卡片
		else if (MemberCardStore.open) {
			MemberCardStore.closeCard()
		}
	})

	useMount(() => {
		const routeParams = getSuperRouteParams(window.location.pathname)
		initializeSuperMagicIfNeeded({
			isMobile: false,
			workspaceId: routeParams.workspaceId,
			projectId: routeParams.projectId,
			topicId: routeParams.topicId,
		})
	})

	return (
		<div className="flex h-screen w-full flex-col bg-sidebar" onClick={handleClick}>
			{isElectron && (
				<Suspense fallback={null}>
					<ElectronHeader />
				</Suspense>
			)}
			<ResizablePanelGroup direction="horizontal">
				{/* Sidebar Panel - always rendered with smooth width transition */}
				<Observer>
					{() => (
						<ResizablePanel
							ref={sidebarPanelRef}
							id="sidebar-panel"
							defaultSize={
								sidebarStore.collapsed
									? sidebarStore.collapsedSizePercent
									: initialWidth
							}
							maxSize={
								sidebarStore.collapsed
									? sidebarStore.collapsedSizePercent
									: sidebarStore.MAX_WIDTH_PERCENT
							}
							minSize={
								sidebarStore.collapsed
									? sidebarStore.collapsedSizePercent
									: sidebarStore.MIN_WIDTH_PERCENT
							}
							onResize={handleSidebarResize}
						>
							<MagicSidebar />
						</ResizablePanel>
					)}
				</Observer>

				{/* Resize Handle - hidden when collapsed */}
				<Observer>
					{() => (
						<ResizableHandle
							disabled={sidebarStore.collapsed}
							className={cn(
								"w-px bg-transparent hover:!bg-transparent",
								sidebarStore.collapsed
									? "pointer-events-none opacity-0"
									: "opacity-100 hover:bg-primary/30",
							)}
						/>
					)}
				</Observer>

				{/* Main Content Panel - "被包裹"效果 */}
				<ResizablePanel id="main-content-panel">
					{/* pl-0: 左侧紧贴侧边栏 | pr-2 py-2: 右侧和上下各 8px 露出背景 */}
					<div className="flex h-full flex-col py-2 pl-0 pr-2">
						{/* 白色容器，带圆角、边框、阴影 */}
						<div className="flex h-full flex-col overflow-hidden">
							<main className="flex-1 overflow-auto">{Content}</main>
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
