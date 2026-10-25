import type { ReactNode } from "react"
import { useMemoizedFn } from "ahooks"
import type { MicroAppPreviewBrowser, MicroAppPreviewTab } from "../hooks/useMicroAppPreviewFiles"

export interface MicroAppPreviewPageContext {
	tab: MicroAppPreviewTab
	active: boolean
	onOpenFile: (file?: unknown) => void
}
interface Props {
	browser: MicroAppPreviewBrowser
	children: (context: MicroAppPreviewPageContext) => ReactNode
}
function PreviewPage({
	tab,
	active,
	onOpenFile,
	children,
}: {
	tab: MicroAppPreviewTab
	active: boolean
	onOpenFile: MicroAppPreviewBrowser["handlePreviewOpenFile"]
	children: Props["children"]
}) {
	// Bind navigation to its originating context, even when an inactive page opens a link later.
	const openFile = useMemoizedFn((file?: unknown) => onOpenFile(file, tab.id))
	return (
		<div
			role="tabpanel"
			hidden={!active}
			className="h-full min-h-0 w-full"
			data-preview-tab={tab.id}
		>
			{children({ tab, active, onOpenFile: openFile })}
		</div>
	)
}
export default function MicroAppPreviewPages({ browser, children }: Props) {
	return (
		<>
			{browser.previewTabs.map((tab) => (
				<PreviewPage
					key={tab.id}
					tab={tab}
					active={tab.id === browser.activePreviewTabId}
					onOpenFile={browser.handlePreviewOpenFile}
				>
					{children}
				</PreviewPage>
			))}
		</>
	)
}
