import * as React from "react"
import * as PopoverPrimitive from "@radix-ui/react-popover"

import { cn } from "@/utils/cn"
import {
	useOverlayInteractionScopeAttributes,
	useOverlayInteractionScopeContentAttributes,
} from "./overlay-interaction-scope"
import {
	OverlayZIndexProvider,
	resolveEffectiveOverlayZIndex,
	useCurrentOverlayZIndex,
} from "@/utils/overlayZIndex"

function Popover({ ...props }: React.ComponentProps<typeof PopoverPrimitive.Root>) {
	return <PopoverPrimitive.Root data-slot="popover" {...props} />
}

function PopoverTrigger({ ...props }: React.ComponentProps<typeof PopoverPrimitive.Trigger>) {
	const overlayScopeAttributes = useOverlayInteractionScopeAttributes()

	return (
		<PopoverPrimitive.Trigger
			data-slot="popover-trigger"
			{...props}
			{...overlayScopeAttributes}
		/>
	)
}

const PopoverContent = React.forwardRef<
	React.ElementRef<typeof PopoverPrimitive.Content>,
	React.ComponentPropsWithoutRef<typeof PopoverPrimitive.Content> & {
		container?: HTMLElement | null
	}
>(function PopoverContent(
	{ className, align = "center", sideOffset = 4, container, style, children, ...props },
	ref,
) {
	const overlayScopeAttributes = useOverlayInteractionScopeContentAttributes()
	const currentOverlayZIndex = useCurrentOverlayZIndex()
	const effectiveZIndex = resolveEffectiveOverlayZIndex(currentOverlayZIndex, style?.zIndex, 10)

	return (
		<PopoverPrimitive.Portal {...(container != null ? { container } : {})}>
			<PopoverPrimitive.Content
				ref={ref}
				data-slot="popover-content"
				align={align}
				sideOffset={sideOffset}
				className={cn(
					"origin-(--radix-popover-content-transform-origin) w-72 rounded-md border bg-popover p-4 text-popover-foreground shadow-md outline-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2",
					effectiveZIndex == null && "z-50",
					className,
				)}
				style={{
					...style,
					...(effectiveZIndex != null ? { zIndex: effectiveZIndex } : {}),
				}}
				{...props}
				{...overlayScopeAttributes}
			>
				{effectiveZIndex != null ? (
					<OverlayZIndexProvider value={effectiveZIndex}>
						{children}
					</OverlayZIndexProvider>
				) : (
					children
				)}
			</PopoverPrimitive.Content>
		</PopoverPrimitive.Portal>
	)
})

function PopoverAnchor({ ...props }: React.ComponentProps<typeof PopoverPrimitive.Anchor>) {
	return <PopoverPrimitive.Anchor data-slot="popover-anchor" {...props} />
}

export { Popover, PopoverTrigger, PopoverContent, PopoverAnchor }
