import { useId, useLayoutEffect, useState, type ReactNode } from "react"
import { useTranslation } from "react-i18next"
import {
	ResizableHandle,
	ResizablePanel,
	ResizablePanelGroup,
} from "@/components/shadcn-ui/resizable"

/** 管理器与文件选择器共用分栏，保留各自的滚动、搜索和已选文件状态。 */
export function ProjectBrowserLayout({
	sidebar,
	children,
	minContentWidth = 320,
}: {
	sidebar: ReactNode
	children: ReactNode
	minContentWidth?: number
}) {
	const { t } = useTranslation("super")
	const id = useId()
	const [container, setContainer] = useState<HTMLDivElement | null>(null)
	const [width, setWidth] = useState(1000)
	useLayoutEffect(() => {
		if (!container) return
		// 弹窗会缩放，也可能经 Portal 延迟挂载，约束跟随真实内容宽度。
		const measure = () => {
			if (container.clientWidth > 0) setWidth(container.clientWidth)
		}
		const observer = new ResizeObserver(measure)
		observer.observe(container)
		measure()
		return () => observer.disconnect()
	}, [container])
	const available = Math.max(width - 1, 1)
	// 正常窗口侧栏至少 160px、至多 360px；极窄窗口优先为正文保留 60%。
	const minWidth = Math.min(160, available * 0.4)
	const maxWidth = Math.max(minWidth, Math.min(360, available - minContentWidth))

	return (
		<div
			ref={setContainer}
			className="flex min-h-0 min-w-0 flex-1"
			data-testid="project-browser-layout"
		>
			<ResizablePanelGroup
				direction="horizontal"
				keyboardResizeBy={2}
				className="min-h-0 min-w-0 flex-1"
			>
				<ResizablePanel
					id={`${id}-sidebar`}
					order={1}
					defaultSize={20}
					minSize={(minWidth / available) * 100}
					maxSize={(maxWidth / available) * 100}
					className="flex min-h-0 min-w-0"
				>
					{sidebar}
				</ResizablePanel>
				<ResizableHandle
					withHandle
					aria-label={t("selectPathModal.resizeSidebar")}
					data-testid="project-browser-sidebar-resize"
					className="shrink-0 hover:bg-primary/40 data-[resize-handle-state=drag]:bg-primary/40"
				/>
				<ResizablePanel id={`${id}-content`} order={2} className="flex min-h-0 min-w-0">
					{children}
				</ResizablePanel>
			</ResizablePanelGroup>
		</div>
	)
}
