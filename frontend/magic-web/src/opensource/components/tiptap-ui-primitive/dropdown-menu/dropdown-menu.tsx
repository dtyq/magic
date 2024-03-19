import * as React from "react"
import * as DropdownMenuPrimitive from "@radix-ui/react-dropdown-menu"
import { cn } from "@/opensource/lib/tiptap-utils"
import "@/opensource/components/tiptap-ui-primitive/dropdown-menu/dropdown-menu.scss"

function DropdownMenu({ ...props }: React.ComponentProps<typeof DropdownMenuPrimitive.Root>) {
	return <DropdownMenuPrimitive.Root modal={false} {...props} />
}

function DropdownMenuPortal({
	...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Portal>) {
	return <DropdownMenuPrimitive.Portal {...props} />
}

const DropdownMenuTrigger = React.forwardRef<
	React.ComponentRef<typeof DropdownMenuPrimitive.Trigger>,
	React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Trigger>
>(({ ...props }, ref) => <DropdownMenuPrimitive.Trigger ref={ref} {...props} />)
DropdownMenuTrigger.displayName = DropdownMenuPrimitive.Trigger.displayName

const DropdownMenuGroup = DropdownMenuPrimitive.Group

const DropdownMenuSub = DropdownMenuPrimitive.Sub

const DropdownMenuRadioGroup = DropdownMenuPrimitive.RadioGroup

const DropdownMenuItem = DropdownMenuPrimitive.Item

const DropdownMenuSubTrigger = DropdownMenuPrimitive.SubTrigger

const DropdownMenuSubContent = React.forwardRef<
	React.ComponentRef<typeof DropdownMenuPrimitive.SubContent>,
	React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.SubContent> & {
		portal?: boolean | React.ComponentProps<typeof DropdownMenuPortal>
	}
>(({ className, portal = true, ...props }, ref) => {
	const content = (
		<DropdownMenuPrimitive.SubContent
			ref={ref}
			className={cn("tiptap-dropdown-menu", "tiptap-editor-root", className)}
			{...props}
		/>
	)

	return portal ? (
		<DropdownMenuPortal {...(typeof portal === "object" ? portal : {})}>
			{content}
		</DropdownMenuPortal>
	) : (
		content
	)
})
DropdownMenuSubContent.displayName = DropdownMenuPrimitive.SubContent.displayName

const DropdownMenuContent = React.forwardRef<
	React.ComponentRef<typeof DropdownMenuPrimitive.Content>,
	React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Content> & {
		portal?: boolean
	}
>(({ className, sideOffset = 4, portal = false, ...props }, ref) => {
	const content = (
		<DropdownMenuPrimitive.Content
			ref={ref}
			sideOffset={sideOffset}
			onCloseAutoFocus={(e) => e.preventDefault()}
			className={cn("tiptap-dropdown-menu", "tiptap-editor-root", className)}
			{...props}
		/>
	)

	return portal ? (
		<DropdownMenuPortal {...(typeof portal === "object" ? portal : {})}>
			{content}
		</DropdownMenuPortal>
	) : (
		content
	)
})
DropdownMenuContent.displayName = DropdownMenuPrimitive.Content.displayName

export {
	DropdownMenu,
	DropdownMenuTrigger,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuGroup,
	DropdownMenuSub,
	DropdownMenuPortal,
	DropdownMenuSubContent,
	DropdownMenuSubTrigger,
	DropdownMenuRadioGroup,
}
