"use client"

import * as React from "react"
// PROJECT OVERRIDE — radix-ui barrel; retain when merging alert-dialog.
import { AlertDialog as AlertDialogPrimitive } from "radix-ui"

import { cn } from "@/lib/utils"
import { Button } from "@/components/shadcn-ui/button"

function AlertDialog({ ...props }: React.ComponentProps<typeof AlertDialogPrimitive.Root>) {
	return <AlertDialogPrimitive.Root data-slot="alert-dialog" {...props} />
}

function AlertDialogTrigger({
	...props
}: React.ComponentProps<typeof AlertDialogPrimitive.Trigger>) {
	return <AlertDialogPrimitive.Trigger data-slot="alert-dialog-trigger" {...props} />
}

function AlertDialogPortal({ ...props }: React.ComponentProps<typeof AlertDialogPrimitive.Portal>) {
	return <AlertDialogPrimitive.Portal data-slot="alert-dialog-portal" {...props} />
}

function AlertDialogOverlay({
	className,
	...props
}: React.ComponentProps<typeof AlertDialogPrimitive.Overlay>) {
	return (
		<AlertDialogPrimitive.Overlay
			data-slot="alert-dialog-overlay"
			className={cn(
				// PROJECT OVERRIDE — data-open variants, z-modal, light scrim, blur.
				"data-open:animate-in data-closed:animate-out data-closed:fade-out-0 data-open:fade-in-0 fixed inset-0 z-modal bg-black/10 duration-100 supports-[backdrop-filter]:backdrop-blur-sm",
				className,
			)}
			{...props}
		/>
	)
}

function AlertDialogContent({
	className,
	size = "default",
	...props
}: React.ComponentProps<typeof AlertDialogPrimitive.Content> & {
	size?: "default" | "sm"
}) {
	return (
		<AlertDialogPortal>
			<AlertDialogOverlay />
			<AlertDialogPrimitive.Content
				data-slot="alert-dialog-content"
				data-size={size}
				className={cn(
					// PROJECT OVERRIDE — retain when merging upstream shadcn alert-dialog.
					// Same centered zoom as dialog.tsx; data-open / data-closed translate vars.
					// Also: rounded-xl, ring, max-w-xs — visual tokens differ from upstream.
					"data-open:animate-in data-closed:animate-out data-closed:fade-out-0 data-open:fade-in-0 data-closed:zoom-out-95 data-open:zoom-in-95 data-open:[--tw-enter-translate-x:-50%] data-open:[--tw-enter-translate-y:-50%] data-closed:[--tw-exit-translate-x:-50%] data-closed:[--tw-exit-translate-y:-50%] group/alert-dialog-content fixed left-1/2 top-1/2 z-modal grid w-full -translate-x-1/2 -translate-y-1/2 gap-4 overflow-hidden rounded-xl bg-background p-4 outline-none ring-1 ring-foreground/10 duration-100 data-[size=default]:max-w-xs data-[size=sm]:max-w-xs data-[size=default]:sm:max-w-sm",
					className,
				)}
				{...props}
			/>
		</AlertDialogPortal>
	)
}

function AlertDialogHeader({ className, ...props }: React.ComponentProps<"div">) {
	return (
		<div
			data-slot="alert-dialog-header"
			className={cn(
				"has-data-[slot=alert-dialog-media]:grid-rows-[auto_auto_1fr] has-data-[slot=alert-dialog-media]:gap-x-4 sm:group-data-[size=default]/alert-dialog-content:has-data-[slot=alert-dialog-media]:grid-rows-[auto_1fr] grid grid-rows-[auto_1fr] place-items-center gap-1.5 text-center sm:group-data-[size=default]/alert-dialog-content:place-items-start sm:group-data-[size=default]/alert-dialog-content:text-left",
				className,
			)}
			{...props}
		/>
	)
}

function AlertDialogFooter({ className, ...props }: React.ComponentProps<"div">) {
	return (
		<div
			data-slot="alert-dialog-footer"
			className={cn(
				"-mx-6 -mb-6 flex flex-col-reverse gap-2 rounded-b-xl border-t bg-muted/50 p-4 group-data-[size=sm]/alert-dialog-content:grid group-data-[size=sm]/alert-dialog-content:grid-cols-2 sm:flex-row sm:justify-end",
				className,
			)}
			{...props}
		/>
	)
}

function AlertDialogMedia({ className, ...props }: React.ComponentProps<"div">) {
	return (
		<div
			data-slot="alert-dialog-media"
			className={cn(
				"*:[svg:not([class*='size-'])]:size-6 mb-2 inline-flex size-10 items-center justify-center rounded-md bg-muted sm:group-data-[size=default]/alert-dialog-content:row-span-2",
				className,
			)}
			{...props}
		/>
	)
}

function AlertDialogTitle({
	className,
	...props
}: React.ComponentProps<typeof AlertDialogPrimitive.Title>) {
	return (
		<AlertDialogPrimitive.Title
			data-slot="alert-dialog-title"
			className={cn(
				"sm:group-data-[size=default]/alert-dialog-content:group-has-data-[slot=alert-dialog-media]/alert-dialog-content:col-start-2 text-base font-medium",
				className,
			)}
			{...props}
		/>
	)
}

function AlertDialogDescription({
	className,
	...props
}: React.ComponentProps<typeof AlertDialogPrimitive.Description>) {
	return (
		<AlertDialogPrimitive.Description
			data-slot="alert-dialog-description"
			className={cn(
				"*:[a]:hover:text-foreground *:[a]:underline *:[a]:underline-offset-3 text-balance text-sm text-muted-foreground md:text-pretty",
				className,
			)}
			{...props}
		/>
	)
}

function AlertDialogAction({
	className,
	variant = "default",
	size = "default",
	...props
}: React.ComponentProps<typeof AlertDialogPrimitive.Action> &
	Pick<React.ComponentProps<typeof Button>, "variant" | "size">) {
	return (
		<Button variant={variant} size={size} asChild>
			<AlertDialogPrimitive.Action
				data-slot="alert-dialog-action"
				className={cn(className)}
				{...props}
			/>
		</Button>
	)
}

function AlertDialogCancel({
	className,
	variant = "outline",
	size = "default",
	...props
}: React.ComponentProps<typeof AlertDialogPrimitive.Cancel> &
	Pick<React.ComponentProps<typeof Button>, "variant" | "size">) {
	return (
		<Button variant={variant} size={size} asChild>
			<AlertDialogPrimitive.Cancel
				data-slot="alert-dialog-cancel"
				className={cn(className)}
				{...props}
			/>
		</Button>
	)
}

export {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogMedia,
	AlertDialogOverlay,
	AlertDialogPortal,
	AlertDialogTitle,
	AlertDialogTrigger,
}
