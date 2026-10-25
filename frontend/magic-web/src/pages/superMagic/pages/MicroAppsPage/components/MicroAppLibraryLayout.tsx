import { useLayoutEffect, useRef, useState, type ReactNode } from "react"
import { useTranslation } from "react-i18next"
import {
	ResizableHandle,
	ResizablePanel,
	ResizablePanelGroup,
} from "@/components/shadcn-ui/resizable"
import { platformKey } from "@/utils/storage"

export default function MicroAppLibraryLayout({
	development,
	access,
}: {
	development: ReactNode
	access: ReactNode
}) {
	const { t } = useTranslation("super")
	const containerRef = useRef<HTMLDivElement>(null)
	const [width, setWidth] = useState(0)

	useLayoutEffect(() => {
		const container = containerRef.current
		if (!container) return
		const observer = new ResizeObserver(([entry]) => {
			// Search hides this layout; retain its structure and mounted panel scroll positions.
			if (entry.contentRect.width > 0) setWidth(entry.contentRect.width)
		})
		setWidth(container.clientWidth)
		observer.observe(container)
		return () => observer.disconnect()
	}, [])

	return (
		<div className="h-full min-h-0" ref={containerRef} data-testid="micro-apps-library-layout">
			{width >= 820 ? (
				<ResizablePanelGroup
					direction="horizontal"
					autoSaveId={platformKey("micro-apps-library-layout")}
					className="h-full min-h-0"
				>
					<ResizablePanel
						id="development"
						order={1}
						defaultSize={70}
						minSize={35}
						className="h-full min-h-0"
					>
						{development}
					</ResizablePanel>
					{/* The wide hit area is transparent; only its central hairline is visible. */}
					<ResizableHandle
						aria-label={t("microAppsPage.resizePanels")}
						data-testid="micro-apps-library-resize"
						className="group mx-3 w-3 bg-transparent after:w-px after:bg-border/60 hover:after:bg-primary/40 focus-visible:after:bg-primary data-[resize-handle-state=drag]:after:bg-primary"
					/>
					<ResizablePanel
						id="access"
						order={2}
						defaultSize={30}
						minSize={30}
						className="h-full min-h-0"
					>
						{access}
					</ResizablePanel>
				</ResizablePanelGroup>
			) : (
				// Stacked layouts never write over the saved desktop proportions.
				<div className="grid h-full min-h-0 min-w-0 grid-rows-2 gap-4">
					{development}
					<div className="min-w-0 border-t border-border/50 pt-4">{access}</div>
				</div>
			)}
		</div>
	)
}
