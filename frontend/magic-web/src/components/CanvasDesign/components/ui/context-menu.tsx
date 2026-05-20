import * as React from "react"
import * as ContextMenuPrimitive from "@radix-ui/react-context-menu"
import { Check, ChevronRight, Circle } from "lucide-react"

import { cn } from "../../lib/utils"
import { usePortalContainer } from "./custom/PortalContainerContext"

const ContextMenu = ContextMenuPrimitive.Root

const ContextMenuTrigger = ContextMenuPrimitive.Trigger

const ContextMenuGroup = ContextMenuPrimitive.Group

const ContextMenuPortal = ContextMenuPrimitive.Portal

const ContextMenuSub = ContextMenuPrimitive.Sub

const ContextMenuRadioGroup = ContextMenuPrimitive.RadioGroup

const ContextMenuSubTrigger = React.forwardRef<
	React.ElementRef<typeof ContextMenuPrimitive.SubTrigger>,
	React.ComponentPropsWithoutRef<typeof ContextMenuPrimitive.SubTrigger> & {
		inset?: boolean
	}
>(({ className, inset, children, disabled, ...props }, ref) => (
	<ContextMenuPrimitive.SubTrigger asChild ref={ref} disabled={disabled} {...props}>
		<button
			type="button"
			disabled={disabled}
			className={cn(
				"flex w-full cursor-default select-none appearance-none items-center rounded-sm border-0 bg-transparent px-2 py-1.5 text-left text-sm outline-none focus:bg-accent focus:text-accent-foreground data-[state=open]:bg-accent data-[state=open]:text-accent-foreground",
				inset && "pl-8",
				className,
			)}
		>
			{children}
			<ChevronRight className="ml-auto h-4 w-4" />
		</button>
	</ContextMenuPrimitive.SubTrigger>
))
ContextMenuSubTrigger.displayName = ContextMenuPrimitive.SubTrigger.displayName

const ContextMenuSubContent = React.forwardRef<
	React.ElementRef<typeof ContextMenuPrimitive.SubContent>,
	React.ComponentPropsWithoutRef<typeof ContextMenuPrimitive.SubContent>
>(({ className, ...props }, ref) => {
	const container = usePortalContainer()
	return (
		<ContextMenuPrimitive.SubContent
			ref={ref}
			className={cn(
				"z-[1002] min-w-[8rem] origin-[--radix-context-menu-content-transform-origin] overflow-hidden rounded-md border bg-popover p-1 text-popover-foreground shadow-md data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2",
				className,
			)}
			collisionBoundary={container ? [container] : undefined}
			{...props}
		/>
	)
})
ContextMenuSubContent.displayName = ContextMenuPrimitive.SubContent.displayName

const ContextMenuContent = React.forwardRef<
	React.ElementRef<typeof ContextMenuPrimitive.Content>,
	React.ComponentPropsWithoutRef<typeof ContextMenuPrimitive.Content>
>(({ className, ...props }, ref) => {
	const container = usePortalContainer()
	return (
		<ContextMenuPrimitive.Portal container={container || undefined}>
			<ContextMenuPrimitive.Content
				ref={ref}
				className={cn(
					"z-[1002] max-h-[--radix-context-menu-content-available-height] min-w-[8rem] origin-[--radix-context-menu-content-transform-origin] overflow-y-auto overflow-x-hidden rounded-md border bg-popover p-1 text-popover-foreground shadow-md animate-in fade-in-80 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2",
					className,
				)}
				collisionBoundary={container ? [container] : undefined}
				{...props}
			/>
		</ContextMenuPrimitive.Portal>
	)
})
ContextMenuContent.displayName = ContextMenuPrimitive.Content.displayName

const ContextMenuItem = React.forwardRef<
	React.ElementRef<typeof ContextMenuPrimitive.Item>,
	React.ComponentPropsWithoutRef<typeof ContextMenuPrimitive.Item> & {
		inset?: boolean
	}
>(({ className, inset, children, disabled, ...props }, ref) => (
	<ContextMenuPrimitive.Item asChild ref={ref} disabled={disabled} {...props}>
		<button
			type="button"
			disabled={disabled}
			className={cn(
				"relative flex w-full cursor-default select-none appearance-none items-center rounded-sm border-0 bg-transparent px-2 py-1.5 text-left text-sm outline-none focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
				inset && "pl-8",
				className,
			)}
		>
			{children}
		</button>
	</ContextMenuPrimitive.Item>
))
ContextMenuItem.displayName = ContextMenuPrimitive.Item.displayName

const ContextMenuCheckboxItem = React.forwardRef<
	React.ElementRef<typeof ContextMenuPrimitive.CheckboxItem>,
	React.ComponentPropsWithoutRef<typeof ContextMenuPrimitive.CheckboxItem>
>(({ className, children, checked, ...props }, ref) => (
	<ContextMenuPrimitive.CheckboxItem
		ref={ref}
		className={cn(
			"relative flex cursor-default select-none items-center rounded-sm py-1.5 pl-8 pr-2 text-sm outline-none focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
			className,
		)}
		checked={checked}
		{...props}
	>
		<span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
			<ContextMenuPrimitive.ItemIndicator>
				<Check className="h-4 w-4" />
			</ContextMenuPrimitive.ItemIndicator>
		</span>
		{children}
	</ContextMenuPrimitive.CheckboxItem>
))
ContextMenuCheckboxItem.displayName = ContextMenuPrimitive.CheckboxItem.displayName

const ContextMenuRadioItem = React.forwardRef<
	React.ElementRef<typeof ContextMenuPrimitive.RadioItem>,
	React.ComponentPropsWithoutRef<typeof ContextMenuPrimitive.RadioItem>
>(({ className, children, ...props }, ref) => (
	<ContextMenuPrimitive.RadioItem
		ref={ref}
		className={cn(
			"relative flex cursor-default select-none items-center rounded-sm py-1.5 pl-8 pr-2 text-sm outline-none focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
			className,
		)}
		{...props}
	>
		<span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
			<ContextMenuPrimitive.ItemIndicator>
				<Circle className="h-2 w-2 fill-current" />
			</ContextMenuPrimitive.ItemIndicator>
		</span>
		{children}
	</ContextMenuPrimitive.RadioItem>
))
ContextMenuRadioItem.displayName = ContextMenuPrimitive.RadioItem.displayName

const ContextMenuLabel = React.forwardRef<
	React.ElementRef<typeof ContextMenuPrimitive.Label>,
	React.ComponentPropsWithoutRef<typeof ContextMenuPrimitive.Label> & {
		inset?: boolean
	}
>(({ className, inset, ...props }, ref) => (
	<ContextMenuPrimitive.Label
		ref={ref}
		className={cn(
			"px-2 py-1.5 text-sm font-semibold text-foreground",
			inset && "pl-8",
			className,
		)}
		{...props}
	/>
))
ContextMenuLabel.displayName = ContextMenuPrimitive.Label.displayName

const ContextMenuSeparator = React.forwardRef<
	React.ElementRef<typeof ContextMenuPrimitive.Separator>,
	React.ComponentPropsWithoutRef<typeof ContextMenuPrimitive.Separator>
>(({ className, ...props }, ref) => (
	<ContextMenuPrimitive.Separator
		ref={ref}
		className={cn("-mx-1 my-1 h-px bg-border", className)}
		{...props}
	/>
))
ContextMenuSeparator.displayName = ContextMenuPrimitive.Separator.displayName

const ContextMenuShortcut = ({ className, ...props }: React.HTMLAttributes<HTMLSpanElement>) => {
	return (
		<span
			className={cn("ml-auto text-xs tracking-widest text-muted-foreground", className)}
			{...props}
		/>
	)
}
ContextMenuShortcut.displayName = "ContextMenuShortcut"

export {
	ContextMenu,
	ContextMenuTrigger,
	ContextMenuContent,
	ContextMenuItem,
	ContextMenuCheckboxItem,
	ContextMenuRadioItem,
	ContextMenuLabel,
	ContextMenuSeparator,
	ContextMenuShortcut,
	ContextMenuGroup,
	ContextMenuPortal,
	ContextMenuSub,
	ContextMenuSubContent,
	ContextMenuSubTrigger,
	ContextMenuRadioGroup,
}
