import * as React from "react"
import * as TooltipPrimitive from "@radix-ui/react-tooltip"

import { cn } from "@/utils/cn"
import { TOOLTIP_DELAY_DURATION } from "@/constants/style"
import { omitZIndexClassNames, useCurrentOverlayZIndex } from "@/utils/overlayZIndex"

function TooltipProvider({
	delayDuration = TOOLTIP_DELAY_DURATION,
	skipDelayDuration = 0,
	...props
}: React.ComponentProps<typeof TooltipPrimitive.Provider>) {
	return (
		<TooltipPrimitive.Provider
			data-slot="tooltip-provider"
			delayDuration={delayDuration}
			skipDelayDuration={skipDelayDuration}
			{...props}
		/>
	)
}

function Tooltip({
	delayDuration,
	...props
}: React.ComponentProps<typeof TooltipPrimitive.Root> & {
	/** 覆盖这一条提示的悬停等待。未传时仍使用全局 700ms。 */
	delayDuration?: number
}) {
	return (
		<TooltipProvider delayDuration={delayDuration}>
			<TooltipPrimitive.Root data-slot="tooltip" {...props} />
		</TooltipProvider>
	)
}

function TooltipTrigger({ ...props }: React.ComponentProps<typeof TooltipPrimitive.Trigger>) {
	return <TooltipPrimitive.Trigger data-slot="tooltip-trigger" {...props} />
}

function TooltipContent({
	className,
	sideOffset = 0,
	children,
	container,
	zIndex,
	style,
	...props
}: React.ComponentProps<typeof TooltipPrimitive.Content> & {
	/** 指定 Tooltip 挂载的 DOM 节点，用于全屏等场景避免被裁切 */
	container?: HTMLElement | null
	/** Explicit layer value for local editor overlays. */
	zIndex?: number
}) {
	const currentOverlayZIndex = useCurrentOverlayZIndex()
	const effectiveZIndex =
		zIndex != null
			? currentOverlayZIndex != null
				? Math.max(zIndex, currentOverlayZIndex + 6)
				: zIndex
			: currentOverlayZIndex != null
				? currentOverlayZIndex + 6
				: undefined

	return (
		<TooltipPrimitive.Portal {...(container != null ? { container } : {})}>
			<TooltipPrimitive.Content
				data-slot="tooltip-content"
				sideOffset={sideOffset}
				className={cn(
					"origin-(--radix-tooltip-content-transform-origin) w-fit text-balance rounded-md bg-foreground px-3 py-1.5 text-xs text-background animate-in fade-in-0 zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2",
					effectiveZIndex == null && "z-tooltip",
					effectiveZIndex != null ? omitZIndexClassNames(className) : className,
				)}
				style={{
					...style,
					...(effectiveZIndex == null ? {} : { zIndex: effectiveZIndex }),
				}}
				{...props}
			>
				{children}
				<TooltipPrimitive.Arrow className="z-50 fill-foreground" />
			</TooltipPrimitive.Content>
		</TooltipPrimitive.Portal>
	)
}

export { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider }
