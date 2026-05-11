import * as React from "react"
import * as PopoverPrimitive from "@radix-ui/react-popover"

import { cn } from "../../lib/utils"
import { usePortalContainer } from "./custom/PortalContainerContext"
import {
	PRESERVE_TEXT_EDITOR_FOCUS_ATTR,
	useShouldPreserveTextEditorFocus,
} from "../../utils/preserveTextEditorFocus"

const Popover = PopoverPrimitive.Root

const PopoverTrigger = PopoverPrimitive.Trigger

const PopoverContent = React.forwardRef<
	React.ElementRef<typeof PopoverPrimitive.Content>,
	React.ComponentPropsWithoutRef<typeof PopoverPrimitive.Content>
>(({ className, align = "center", sideOffset = 4, ...props }, ref) => {
	const container = usePortalContainer()
	const shouldPreserveTextEditorFocus = useShouldPreserveTextEditorFocus()
	return (
		<PopoverPrimitive.Portal container={container || undefined}>
			<PopoverPrimitive.Content
				ref={ref}
				align={align}
				sideOffset={sideOffset}
				/** 与 SelectContent 一致：避免 Canvas 全局点击取消选中时把 Portal 内点击当成「画布外」 */
				data-canvas-ui-component
				{...(shouldPreserveTextEditorFocus
					? { [PRESERVE_TEXT_EDITOR_FOCUS_ATTR]: "" }
					: {})}
				className={cn(
					"z-50 w-72 origin-[--radix-popover-content-transform-origin] rounded-md border bg-popover p-4 text-popover-foreground shadow-md outline-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2",
					className,
				)}
				{...props}
			/>
		</PopoverPrimitive.Portal>
	)
})
PopoverContent.displayName = PopoverPrimitive.Content.displayName

export { Popover, PopoverTrigger, PopoverContent }
