"use client"

import * as React from "react"
// PROJECT OVERRIDE — direct @radix-ui/react-dialog vs upstream radix-ui barrel.
import * as DialogPrimitive from "@radix-ui/react-dialog"
import { XIcon } from "lucide-react"

import { cn } from "@/lib/utils"

function Dialog({ ...props }: React.ComponentProps<typeof DialogPrimitive.Root>) {
	return <DialogPrimitive.Root data-slot="dialog" {...props} />
}

function DialogTrigger({ ...props }: React.ComponentProps<typeof DialogPrimitive.Trigger>) {
	return <DialogPrimitive.Trigger data-slot="dialog-trigger" {...props} />
}

function DialogPortal({ ...props }: React.ComponentProps<typeof DialogPrimitive.Portal>) {
	return <DialogPrimitive.Portal data-slot="dialog-portal" {...props} />
}

function DialogClose({ ...props }: React.ComponentProps<typeof DialogPrimitive.Close>) {
	return <DialogPrimitive.Close data-slot="dialog-close" {...props} />
}

function DialogOverlay({
	className,
	...props
}: React.ComponentProps<typeof DialogPrimitive.Overlay>) {
	return (
		<DialogPrimitive.Overlay
			data-slot="dialog-overlay"
			className={cn(
				// PROJECT OVERRIDE — z-modal stack token vs upstream z-50.
				"fixed inset-0 z-modal bg-black/50 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
				className,
			)}
			{...props}
		/>
	)
}

function DialogContent({
	className,
	overlayClassName,
	overlayStyle,
	children,
	showCloseButton = true,
	style,
	...props
}: React.ComponentProps<typeof DialogPrimitive.Content> & {
	showCloseButton?: boolean
	overlayClassName?: string
	overlayStyle?: React.CSSProperties
}) {
	// PROJECT OVERRIDE — sync overlay z-index with content style for stacking.
	const zIndex = style?.zIndex

	return (
		<DialogPortal data-slot="dialog-portal">
			<DialogOverlay className={overlayClassName} style={{ ...overlayStyle, zIndex }} />
			<DialogPrimitive.Content
				data-slot="dialog-content"
				className={cn(
					// PROJECT OVERRIDE — retain when merging upstream shadcn/ui dialog.
					// Keyframes use (0,0) translate; layout centers with -50% on the box.
					// --tw-* vars align anim translate with centering; avoids corner skew.
					"fixed left-[50%] top-[50%] z-modal grid w-full max-w-[calc(100%-2rem)] translate-x-[-50%] translate-y-[-50%] gap-4 rounded-lg border bg-background p-4 shadow-lg duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=open]:[--tw-enter-translate-x:-50%] data-[state=open]:[--tw-enter-translate-y:-50%] data-[state=closed]:[--tw-exit-translate-x:-50%] data-[state=closed]:[--tw-exit-translate-y:-50%] sm:max-w-lg",
					className,
				)}
				style={style}
				{...props}
			>
				{children}
				{showCloseButton && (
					<DialogPrimitive.Close
						data-slot="dialog-close"
						className="focus:outline-hidden absolute right-4 top-4 rounded-xs opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-accent data-[state=open]:text-muted-foreground [&_svg:not([class*='size-'])]:size-4 [&_svg]:pointer-events-none [&_svg]:shrink-0"
					>
						<XIcon />
						<span className="sr-only">Close</span>
					</DialogPrimitive.Close>
				)}
			</DialogPrimitive.Content>
		</DialogPortal>
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
	// PROJECT OVERRIDE — layout only; upstream may add footer showCloseButton API.
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
