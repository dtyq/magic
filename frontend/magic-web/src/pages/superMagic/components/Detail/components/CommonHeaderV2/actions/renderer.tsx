import type { ReactNode, RefObject } from "react"
import { CircleHelp } from "lucide-react"
import { cn } from "@/lib/utils"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/shadcn-ui/popover"
import type { ActionContext, BuiltinComposedAction, ComposedAction } from "../types"

interface ActionRendererProps {
	actions: ComposedAction[]
	context: ActionContext
	renderBuiltinAction: (action: BuiltinComposedAction) => ReactNode
	rightContainerRef?: RefObject<HTMLDivElement>
	gap?: string // 按钮之间的间距，支持 CSS 变量
}

function renderAction(
	action: ComposedAction,
	context: ActionContext,
	renderBuiltinAction: (action: BuiltinComposedAction) => ReactNode,
) {
	if (action.kind === "custom") {
		const zoneShowText = action.zone === "leading" || action.zone === "primary"
		return action.render({
			...context,
			showButtonText: zoneShowText ? true : context.showButtonText,
		})
	}
	return renderBuiltinAction(action)
}

function renderMobileShareFileName(fileName: string, filePath?: string) {
	const trimmedFilePath = filePath?.trim()

	return (
		<div
			key="mobile-share-file-name"
			className="flex min-w-0 flex-1 items-center gap-1 px-1"
			data-testid="detail-header-mobile-share-file-name"
			title={trimmedFilePath || fileName}
		>
			<span className="min-w-0 truncate text-sm font-medium text-foreground">{fileName}</span>
			{trimmedFilePath ? (
				<Popover modal={false}>
					<PopoverTrigger asChild>
						<button
							type="button"
							className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
							aria-label="Show file path"
							data-testid="detail-header-mobile-share-file-path-trigger"
						>
							<CircleHelp size={14} strokeWidth={1.8} />
						</button>
					</PopoverTrigger>
					<PopoverContent
						align="start"
						side="bottom"
						sideOffset={6}
						className="!z-[1050] w-fit max-w-[calc(100vw-24px)] p-1.5"
						data-testid="detail-header-mobile-share-file-path-popover"
					>
						<div className="max-h-32 max-w-[min(320px,calc(100vw-40px))] overflow-y-auto break-all font-mono text-[11px] leading-4 text-foreground">
							{trimmedFilePath}
						</div>
					</PopoverContent>
				</Popover>
			) : null}
		</div>
	)
}

export default function ActionRenderer(props: ActionRendererProps) {
	const { actions, context, renderBuiltinAction, rightContainerRef, gap } = props

	const leading = actions.filter((item) => item.zone === "leading")
	const primary = actions.filter((item) => item.zone === "primary")
	const secondary = actions.filter((item) => item.zone === "secondary")
	const overflow = actions.filter((item) => item.zone === "overflow")
	const trailing = actions.filter((item) => item.zone === "trailing")
	const leftActions = [...leading, ...primary]
	const rightActions = [...secondary, ...overflow, ...trailing]

	const gapStyle = gap ? { gap } : undefined
	const mobileShareFileName =
		context.isMobile && context.isShareRoute ? context.currentFile?.name?.trim() : undefined
	const mobileShareFilePath = context.currentFile?.relativeFilePath

	return (
		<div
			className={cn("flex w-full min-w-0 items-center gap-2 whitespace-nowrap")}
			data-testid="detail-header-action-renderer"
		>
			<div
				className={cn(
					"flex items-center gap-1",
					mobileShareFileName ? "min-w-0 flex-1" : "shrink-0",
				)}
				style={gapStyle}
				data-testid="detail-header-left-actions"
			>
				{leftActions.map((action) => (
					<div
						key={`${action.kind}-${action.key}`}
						className="shrink-0"
						data-testid={`detail-header-action-item-${action.key}`}
					>
						{renderAction(action, context, renderBuiltinAction)}
					</div>
				))}
				{mobileShareFileName
					? renderMobileShareFileName(mobileShareFileName, mobileShareFilePath)
					: null}
			</div>
			<div
				ref={rightContainerRef}
				className={cn("ml-auto min-w-0", mobileShareFileName ? "shrink-0" : "flex-1")}
				data-testid="detail-header-right-actions"
			>
				<div className="ml-auto flex w-max items-center gap-1" style={gapStyle}>
					{rightActions.map((action) => (
						<div
							key={`${action.kind}-${action.key}`}
							className="shrink-0"
							data-testid={`detail-header-action-item-${action.key}`}
						>
							{renderAction(action, context, renderBuiltinAction)}
						</div>
					))}
				</div>
			</div>
		</div>
	)
}
