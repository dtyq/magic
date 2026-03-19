import { createElement, forwardRef } from "react"
import type { LucideIcon, LucideProps } from "lucide-react"

import { cn } from "@/lib/utils"

export type IconNode = ReadonlyArray<readonly [string, Record<string, string>]>

function hasA11yProp(props: Record<string, unknown>) {
	return (
		props["aria-label"] !== undefined ||
		props["aria-labelledby"] !== undefined ||
		props.title !== undefined
	)
}

function toPascalCase(input: string) {
	return input
		.split(/[-_\s]+/g)
		.filter(Boolean)
		.map((part) => part.charAt(0).toUpperCase() + part.slice(1))
		.join("")
}

function toKebabCase(input: string) {
	return input
		.replace(/([a-z0-9])([A-Z])/g, "$1-$2")
		.replace(/\s+/g, "-")
		.toLowerCase()
}

export function createLucideIcon(
	iconName: string,
	iconNode: IconNode,
	options?: {
		viewBox?: string
		defaultSize?: string | number
		defaultStrokeWidth?: number
	},
) {
	const viewBox = options?.viewBox ?? "0 0 24 24"
	const defaultSize = options?.defaultSize ?? 24
	const defaultStrokeWidth = options?.defaultStrokeWidth ?? 2

	const Component = forwardRef<SVGSVGElement, Omit<LucideProps, "ref">>(
		(
			{
				className,
				color = "currentColor",
				size = defaultSize,
				strokeWidth = defaultStrokeWidth,
				absoluteStrokeWidth,
				style,
				children,
				...props
			},
			ref,
		) => {
			const resolvedStrokeWidth = absoluteStrokeWidth
				? (Number(strokeWidth) * 24) / Number(size)
				: strokeWidth

			return createElement(
				"svg",
				{
					ref,
					xmlns: "http://www.w3.org/2000/svg",
					width: size,
					height: size,
					viewBox,
					fill: "none",
					stroke: color,
					strokeLinecap: "round",
					strokeLinejoin: "round",
					// Use inline style so project-level `.lucide { stroke-width: ... }`
					// rules do not accidentally override icon-specific defaults.
					style: {
						strokeWidth: resolvedStrokeWidth,
						...style,
					},
					className: cn(
						"lucide",
						`lucide-${toKebabCase(toPascalCase(iconName))}`,
						`lucide-${iconName}`,
						className,
					),
					...(children || hasA11yProp(props) ? {} : { "aria-hidden": "true" }),
					...props,
				},
				[
					...iconNode.map(([tag, attrs]) => createElement(tag, attrs)),
					...(Array.isArray(children) ? children : [children]),
				],
			)
		},
	)

		; (Component as LucideIcon & { displayName?: string }).displayName = toPascalCase(iconName)

	return Component as LucideIcon
}
