import type { ReactNode, RefObject } from "react"
import { cn } from "@/lib/utils"
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

	return (
		<div
			className={cn("flex w-full min-w-0 items-center gap-2 whitespace-nowrap")}
			data-testid="detail-header-action-renderer"
		>
			<div
				className="flex shrink-0 items-center gap-1"
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
			</div>
			<div
				ref={rightContainerRef}
				className="ml-auto min-w-0 flex-1"
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
