import type { CSSProperties, HTMLAttributes, MouseEventHandler, ReactNode } from "react"
import { useMemo } from "react"
import { Avatar } from "@magic-admin-v2/components/ui/avatar"
import { cn } from "@magic-admin-v2/utils/cn"
import DEFAULT_USER_ICON from "@magic-admin-v2/assets/logos/user-avatar.svg"

export type UserAvatarInfo = {
	id?: string
	name?: string | null
	nickname?: string | null
	realName?: string | null
	real_name?: string | null
	avatar?: string | null
	avatar_url?: string | null
}

export type UserAvatarRenderProps = Omit<
	HTMLAttributes<HTMLSpanElement>,
	"children" | "className" | "style" | "onClick" | "title"
> & {
	userInfo?: UserAvatarInfo | null
	children?: ReactNode
	name?: string | null
	size?: number
	className?: string
	style?: CSSProperties
	src?: string | ReactNode
	onClick?: MouseEventHandler<HTMLSpanElement>
	shape?: "circle" | "square"
	alt?: string
	title?: string
}

function textToBackgroundColor(text: string) {
	let hash = 0
	for (let index = 0; index < text.length; index += 1) {
		hash += text.charCodeAt(index)
	}
	const hue = (hash % 360) + 10
	const saturation = 60 + (hash % 20)
	const lightness = 40 + (hash % 20)
	return `hsl(${hue}, ${saturation}%, ${lightness}%)`
}

function textToDisplayName(text: string) {
	if (!text) return ""
	if (/[\u4e00-\u9fa5]/.test(text)) {
		return text.replace(/[^\u4e00-\u9fa5]/g, "").slice(-2)
	}
	return text[0]?.toUpperCase() ?? ""
}

function escapeSvgText(value: string) {
	return value.replace(/[&<>"']/g, (character) => {
		const entities: Record<string, string> = {
			"&": "&amp;",
			"<": "&lt;",
			">": "&gt;",
			'"': "&quot;",
			"'": "&apos;",
		}
		return entities[character] ?? character
	})
}

function createTextAvatarDataUrl(text: string, backgroundColor: string, textColor = "white") {
	const displayText = textToDisplayName(text)
	if (!displayText) return DEFAULT_USER_ICON

	const fontSize = displayText.length > 1 ? 40 : 50
	const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200"><rect width="200" height="200" fill="${backgroundColor}"/><text x="100" y="108" fill="${textColor}" font-family="Arial,sans-serif" font-size="${fontSize}" font-weight="700" text-anchor="middle" dominant-baseline="middle">${escapeSvgText(displayText)}</text></svg>`
	return `data:image/svg+xml,${encodeURIComponent(svg)}`
}

function getAvatarUrl(avatar: string, size: number) {
	if (!avatar) return avatar
	if (avatar.includes("x-tos-process") || avatar.includes("x-oss-process")) return avatar
	if (/tos-cn|tos\.volces\.com/i.test(avatar)) {
		return `${avatar}?x-tos-process=image/resize,h_${size * 2}/format,webp`
	}
	if (/aliyuncs\.com/i.test(avatar)) {
		return `${avatar}?x-oss-process=image/resize,h_${size * 2}/format,webp`
	}
	if (
		avatar.includes("static-legacy.dingtalk.com") &&
		!avatar.includes(`${size * 2}w_${size * 2}h`)
	) {
		return `${avatar}@${size * 2}w_${size * 2}h`
	}
	return avatar
}

function resolveDisplayName(userInfo: UserAvatarInfo | null | undefined, children: ReactNode) {
	if (typeof children === "string" && children.trim()) return children
	return userInfo?.nickname || userInfo?.realName || userInfo?.real_name || userInfo?.name || ""
}

export function UserAvatarRender({
	userInfo,
	children,
	name,
	size,
	className,
	style,
	src: propSrc,
	onClick,
	shape = "square",
	alt,
	title,
	...restProps
}: UserAvatarRenderProps) {
	const avatarSize = size ?? 40
	const displayName = name || resolveDisplayName(userInfo, children)
	const avatar = userInfo?.avatar_url || userInfo?.avatar || ""
	const hasCustomNodeSource = Boolean(propSrc && typeof propSrc !== "string")
	const avatarSrc = useMemo(() => {
		if (propSrc) return typeof propSrc === "string" ? getAvatarUrl(propSrc, avatarSize) : null
		return getAvatarUrl(avatar || DEFAULT_USER_ICON, avatarSize)
	}, [avatar, avatarSize, propSrc])
	const fallbackText = typeof displayName === "string" ? displayName.slice(-1).toUpperCase() : ""
	const textAvatarSrc = useMemo(
		() =>
			createTextAvatarDataUrl(
				displayName,
				typeof style?.backgroundColor === "string"
					? style.backgroundColor
					: textToBackgroundColor(displayName),
				typeof style?.color === "string" ? style.color : "white",
			),
		[displayName, style?.backgroundColor, style?.color],
	)

	return (
		<Avatar
			alt={alt ?? displayName}
			className={cn(
				"shrink-0 border border-border",
				shape === "square" ? "rounded-lg" : "rounded-full",
				onClick && "cursor-pointer",
				size === undefined && "size-10",
				className,
			)}
			fallbackImageSrc={hasCustomNodeSource ? textAvatarSrc : undefined}
			fallbackText={fallbackText || "U"}
			name={displayName}
			onClick={onClick}
			src={avatarSrc}
			style={{
				...(size === undefined ? {} : { width: avatarSize, height: avatarSize }),
				...style,
			}}
			title={title}
			{...restProps}
		/>
	)
}
