import { memo, ReactNode, useEffect, useMemo, useState } from "react"
import { useMemoizedFn } from "ahooks"
import { drawTextAvatar } from "./utils"
import { cn } from "@/lib/utils"
import { Avatar as ShadcnAvatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar"
import { Badge as ShadcnBadge } from "@/components/ui/badge"
import type { MagicAvatarProps } from "./type"

const getTextAvatar = (text: string | ReactNode, backgroundColor?: string, color?: string) => {
	const textString = typeof text === "string" ? text : "未知"
	return drawTextAvatar(textString, backgroundColor, color) ?? ""
}

const Avatar = ({
	children,
	src,
	size = 40,
	fontSize = 12,
	style,
	badgeProps,
	className,
	shape = "square",
	...props
}: MagicAvatarProps) => {
	const [innerSrc, setInnerSrc] = useState<string>(
		src && typeof src === "string"
			? src
			: getTextAvatar(children, style?.backgroundColor, style?.color),
	)

	useEffect(() => {
		setInnerSrc(
			typeof src === "string" && src
				? src
				: getTextAvatar(
						typeof children === "string" ? children : "未知",
						style?.backgroundColor,
						style?.color,
					),
		)
	}, [src, children, style?.backgroundColor, style?.color])

	// Normalize size to number (handle responsive object from antd)
	const normalizedSize = typeof size === "number" ? size : 40

	const mergedStyle = useMemo(
		() => ({
			flex: "none",
			width: normalizedSize,
			height: normalizedSize,
			...style,
		}),
		[style, normalizedSize],
	)

	const handleError = useMemoizedFn(() => {
		setInnerSrc(getTextAvatar(children, style?.backgroundColor, style?.color))
	})

	const avatarContent = (
		<ShadcnAvatar
			style={mergedStyle}
			className={cn(
				"shrink-0 flex items-center justify-center",
				shape === "square" ? "rounded-md" : "rounded-full",
				className,
			)}
			{...props}
		>
			{/* Handle ReactNode src */}
			{src && typeof src === "object" ? (
				src
			) : (
				<>
					{/* Show image for string src or generated text avatar */}
					<AvatarImage
						src={innerSrc}
						alt={typeof children === "string" ? children : "avatar"}
						onError={handleError}
						className="bg-white"
						draggable={false}
					/>
					{/* Fallback when image fails to load */}
					{children && (
						<AvatarFallback style={{ fontSize }}>
							{typeof children === "string" ? children.slice(0, 2) : children}
						</AvatarFallback>
					)}
				</>
			)}
		</ShadcnAvatar>
	)

	if (!badgeProps) {
		return avatarContent
	}

	// Badge 实现 - 使用 shadcn Badge 或自定义实现
	const { count, offset, ...restBadgeProps } = badgeProps

	return (
		<div className="relative inline-block">
			{avatarContent}
			{count !== undefined && count !== null && (
				<ShadcnBadge
					className={cn(
						"absolute -top-1 right-0 flex h-5 min-w-5 items-center justify-center rounded-full border-2 border-background px-1 text-[10px] font-medium",
						typeof count === "number" && count > 0
							? "bg-destructive text-destructive-foreground"
							: "hidden",
					)}
					style={{
						transform: offset ? `translate(${offset[0]}px, ${offset[1]}px)` : undefined,
					}}
					{...restBadgeProps}
				>
					{typeof count === "number" && count > 99 ? "99+" : count}
				</ShadcnBadge>
			)}
		</div>
	)
}

export default memo(Avatar)
