import { Button } from "@/opensource/components/shadcn-ui/button"

/**
 * Convert antd-style button props to shadcn button props
 * Provides backward compatibility for components using antd Modal button props
 *
 * @example
 * // Convert antd-style props
 * convertButtonProps({ color: "danger", variant: "solid" })
 * // Returns: { variant: "destructive" }
 *
 * @example
 * // Keep shadcn-style props
 * convertButtonProps({ variant: "destructive" })
 * // Returns: { variant: "destructive" }
 */
export function convertButtonProps(
	props?: Record<string, unknown>,
): React.ComponentProps<typeof Button> {
	if (!props) return {}

	const converted: Record<string, unknown> = { ...props }

	// Convert color prop to variant
	if ("color" in props) {
		const color = props.color
		delete converted.color

		if (color === "danger" || color === "error") {
			converted.variant = "destructive"
		} else if (color === "primary") {
			converted.variant = "default"
		} else if (color === "default") {
			converted.variant = "outline"
		}
	}

	// Convert variant prop (antd style to shadcn style)
	if ("variant" in props) {
		const variant = props.variant
		// Only convert if it's antd-style variant
		if (variant === "solid" || variant === "filled") {
			// Keep the converted variant from color, or use default
			if (!converted.variant) {
				converted.variant = "default"
			}
		}
	}

	if ("danger" in props) {
		delete converted.danger

		if (props.danger) {
			converted.variant = "destructive"
		}
	}

	return converted as React.ComponentProps<typeof Button>
}
