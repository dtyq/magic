import { forwardRef } from "react"
import type { ElementRef, ComponentPropsWithoutRef } from "react"
import * as DialogPrimitive from "@radix-ui/react-dialog"
import { cn } from "@/lib/utils"

const MobilePopup = DialogPrimitive.Root

const MobilePopupTrigger = DialogPrimitive.Trigger

const MobilePopupOverlay = forwardRef<
	ElementRef<typeof DialogPrimitive.Overlay>,
	ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
	<DialogPrimitive.Overlay
		ref={ref}
		className={cn(
			"fixed inset-0 z-50 bg-black/50 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
			className,
		)}
		{...props}
	/>
))
MobilePopupOverlay.displayName = "MobilePopupOverlay"

const MobilePopupContent = forwardRef<
	ElementRef<typeof DialogPrimitive.Content>,
	ComponentPropsWithoutRef<typeof DialogPrimitive.Content> & {
		position?: "bottom" | "top" | "left" | "right"
	}
>(({ className, children, position = "bottom", ...props }, ref) => {
	const positionClasses = {
		bottom: "bottom-0 left-0 right-0 top-auto translate-y-0 data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom rounded-t-lg",
		top: "top-0 left-0 right-0 bottom-auto translate-y-0 data-[state=closed]:slide-out-to-top data-[state=open]:slide-in-from-top rounded-b-lg",
		left: "left-0 top-0 bottom-0 right-auto translate-x-0 data-[state=closed]:slide-out-to-left data-[state=open]:slide-in-from-left rounded-r-lg",
		right: "right-0 top-0 bottom-0 left-auto translate-x-0 data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right rounded-l-lg",
	}

	return (
		<DialogPrimitive.Portal>
			<MobilePopupOverlay />
			<DialogPrimitive.Content
				ref={ref}
				className={cn(
					"fixed z-50 gap-4 border bg-background p-0 shadow-lg duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
					positionClasses[position],
					className,
				)}
				{...props}
			>
				{children}
			</DialogPrimitive.Content>
		</DialogPrimitive.Portal>
	)
})
MobilePopupContent.displayName = "MobilePopupContent"

export { MobilePopup, MobilePopupTrigger, MobilePopupContent }
