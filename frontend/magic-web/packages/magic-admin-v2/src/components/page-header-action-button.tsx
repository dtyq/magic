import { Children, type ReactNode } from "react"
import { Button, type ButtonProps } from "@magic-admin-v2/components/ui/button"
import { cn } from "@magic-admin-v2/utils/cn"

type PageHeaderActionButtonProps = Omit<ButtonProps, "children" | "size"> & {
	/** The accessible and desktop-visible action label for the explicit icon/label form. */
	label?: string
	/** The icon remains visible when the mobile label is hidden. */
	icon?: ReactNode
	/** Existing button children are supported so page actions can migrate without changing behavior. */
	children?: ReactNode
}

function renderResponsiveChildren(children: ReactNode) {
	return Children.map(children, (child) => {
		if (typeof child === "string" || typeof child === "number") {
			return <span className="sr-only md:not-sr-only">{child}</span>
		}
		return child
	})
}

/**
 * Keeps page-header actions compact below the Admin V2 mobile breakpoint while
 * preserving a real accessible name for keyboard and assistive-technology users.
 */
export function PageHeaderActionButton({
	children,
	className,
	icon,
	label,
	...props
}: PageHeaderActionButtonProps) {
	const content =
		icon !== undefined || label !== undefined ? (
			<>
				{icon}
				{label !== undefined ? <span className="sr-only md:not-sr-only">{label}</span> : null}
			</>
		) : (
			renderResponsiveChildren(children)
		)

	return (
		<Button
			{...props}
			aria-label={props["aria-label"] ?? label}
			className={cn("h-9 w-9 px-0 md:w-auto md:px-3", className)}
		>
			{content}
		</Button>
	)
}
