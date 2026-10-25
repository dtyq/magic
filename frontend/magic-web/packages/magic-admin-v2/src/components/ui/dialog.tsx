import * as DialogPrimitive from "@radix-ui/react-dialog"
import { X } from "lucide-react"
import * as React from "react"
import { PortalThemeScope } from "@magic-admin-v2/components/ui/portal-theme-scope"
import { cn } from "@magic-admin-v2/utils/cn"

function Dialog({ ...props }: React.ComponentProps<typeof DialogPrimitive.Root>) {
	return <DialogPrimitive.Root data-slot="dialog" {...props} />
}

function DialogTrigger({ ...props }: React.ComponentProps<typeof DialogPrimitive.Trigger>) {
	return <DialogPrimitive.Trigger data-slot="dialog-trigger" {...props} />
}

function DialogPortal({ children, ...props }: React.ComponentProps<typeof DialogPrimitive.Portal>) {
	return (
		<DialogPrimitive.Portal data-slot="dialog-portal" {...props}>
			<PortalThemeScope>{children}</PortalThemeScope>
		</DialogPrimitive.Portal>
	)
}

function DialogClose({ ...props }: React.ComponentProps<typeof DialogPrimitive.Close>) {
	return <DialogPrimitive.Close data-slot="dialog-close" {...props} />
}

const DialogOverlay = React.forwardRef<
	React.ElementRef<typeof DialogPrimitive.Overlay>,
	React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
	<DialogPrimitive.Overlay
		ref={ref}
		data-slot="dialog-overlay"
		className={cn(
			"fixed inset-0 z-50 bg-black/50 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:animate-in data-[state=open]:fade-in-0",
			className,
		)}
		{...props}
	/>
))

DialogOverlay.displayName = DialogPrimitive.Overlay.displayName

function DialogContent({
	children,
	className,
	closeButtonTestId,
	showCloseButton = true,
	onInteractOutside,
	onPointerDownOutside,
	style,
	...props
}: React.ComponentProps<typeof DialogPrimitive.Content> & {
	closeButtonTestId?: string
	showCloseButton?: boolean
}) {
	const handlePointerDownOutside = React.useCallback<
		NonNullable<React.ComponentProps<typeof DialogPrimitive.Content>["onPointerDownOutside"]>
	>(
		(event) => {
			onPointerDownOutside?.(event)
			if (event.defaultPrevented) {
				return
			}
			if (shouldKeepDialogOpen(event)) {
				event.preventDefault()
			}
		},
		[onPointerDownOutside],
	)

	const handleInteractOutside = React.useCallback<
		NonNullable<React.ComponentProps<typeof DialogPrimitive.Content>["onInteractOutside"]>
	>(
		(event) => {
			onInteractOutside?.(event)
			if (event.defaultPrevented) {
				return
			}
			if (shouldKeepDialogOpen(event)) {
				event.preventDefault()
			}
		},
		[onInteractOutside],
	)

	return (
		<DialogPortal>
			<DialogOverlay />
			<DialogPrimitive.Content
				data-slot="dialog-content"
				className={cn(
					"fixed left-1/2 top-1/2 z-[60] grid w-full max-w-[calc(100%-2rem)] -translate-x-1/2 -translate-y-1/2 gap-4 rounded-lg border bg-background p-6 shadow-lg duration-200 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95 sm:max-w-lg",
					className,
				)}
				onInteractOutside={handleInteractOutside}
				onPointerDownOutside={handlePointerDownOutside}
				style={{ ...style, pointerEvents: "auto" }}
				{...props}
			>
				{children}
				{showCloseButton ? (
					<DialogPrimitive.Close
						data-testid={closeButtonTestId}
						className="absolute right-4 top-4 rounded-xs opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none"
					>
						<X className="size-4" />
						<span className="sr-only">Close</span>
					</DialogPrimitive.Close>
				) : null}
			</DialogPrimitive.Content>
		</DialogPortal>
	)
}

function shouldKeepDialogOpen(event: Event) {
	const target = event.target

	if (!(target instanceof Element)) {
		return false
	}

	return Boolean(
		target.closest(
			[
				"[data-slot='dialog-content']",
				"[data-slot='alert-dialog-content']",
				"[data-radix-popper-content-wrapper]",
				"[data-slot='dropdown-menu-content']",
				"[data-slot='dropdown-menu-sub-content']",
				"[data-slot='popover-content']",
				"[data-slot='select-content']",
			].join(","),
		),
	)
}

function DialogHeader({ className, ...props }: React.ComponentProps<"div">) {
	return (
		<div
			data-slot="dialog-header"
			className={cn("flex flex-col gap-2 text-center sm:text-left", className)}
			{...props}
		/>
	)
}

function DialogFooter({ className, ...props }: React.ComponentProps<"div">) {
	return (
		<div
			data-slot="dialog-footer"
			className={cn("flex flex-col-reverse gap-2 sm:flex-row sm:justify-end", className)}
			{...props}
		/>
	)
}

function DialogTitle({ className, ...props }: React.ComponentProps<typeof DialogPrimitive.Title>) {
	return (
		<DialogPrimitive.Title
			data-slot="dialog-title"
			className={cn("text-lg font-semibold leading-none", className)}
			{...props}
		/>
	)
}

function DialogDescription({
	className,
	...props
}: React.ComponentProps<typeof DialogPrimitive.Description>) {
	return (
		<DialogPrimitive.Description
			data-slot="dialog-description"
			className={cn("text-sm text-muted-foreground", className)}
			{...props}
		/>
	)
}

export {
	Dialog,
	DialogClose,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogOverlay,
	DialogPortal,
	DialogTitle,
	DialogTrigger,
}
