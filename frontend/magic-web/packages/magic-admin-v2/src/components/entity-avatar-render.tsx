import type { CSSProperties, ReactNode } from "react"
import { Avatar } from "@magic-admin-v2/components/ui/avatar"
import { cn } from "@magic-admin-v2/utils/cn"

export type EntityAvatarRenderProps = {
	alt?: string
	className?: string
	fallbackIcon?: ReactNode
	fallbackImageSrc?: string | null
	fallbackText?: string
	imageClassName?: string
	name?: string
	size?: number
	src?: string | null
	style?: CSSProperties
	shape?: "circle" | "square"
	title?: string
}

export function EntityAvatarRender({
	alt = "",
	className,
	fallbackIcon,
	fallbackImageSrc,
	fallbackText,
	imageClassName,
	name,
	size,
	src,
	style,
	shape = "square",
	title,
}: EntityAvatarRenderProps) {
	const avatarSize = size ?? 40

	return (
		<Avatar
			alt={alt}
			className={cn(
				"shrink-0 border border-border",
				shape === "square" ? "rounded-lg" : "rounded-full",
				size === undefined && "size-10",
				className,
			)}
			fallbackIcon={fallbackIcon}
			fallbackImageSrc={fallbackImageSrc}
			fallbackText={fallbackText}
			imageClassName={imageClassName}
			name={name}
			src={src}
			style={{
				...(size === undefined ? {} : { width: avatarSize, height: avatarSize }),
				...style,
			}}
			title={title}
		/>
	)
}
