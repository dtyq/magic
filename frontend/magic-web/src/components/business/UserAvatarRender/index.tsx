import { Avatar, AvatarImage, AvatarFallback } from "@/components/shadcn-ui/avatar"
import { observer } from "mobx-react-lite"
import DEFAULT_USER_ICON from "@/assets/logos/user-avatar.svg"
import { User } from "@/types/user"
import { getAvatarUrl } from "@/utils/avatar"
import { useMemo, type CSSProperties } from "react"
import { cn } from "@/lib/utils"
import AvatarService from "@/services/chat/avatar"

interface UserAvatarRenderProps {
	userInfo?: User.UserInfo | null
	children?: React.ReactNode
	size?: number
	className?: string
	style?: CSSProperties
	src?: string | React.ReactNode
	onClick?: () => void
	shape?: "circle" | "square"
}

const UserAvatarRender = observer(
	({
		userInfo,
		children,
		size = 40,
		className,
		style,
		src: propSrc,
		onClick,
		shape = "square",
		...props
	}: UserAvatarRenderProps) => {
		const avatarSrc = userInfo?.avatar || DEFAULT_USER_ICON

		const src = useMemo(() => {
			if (propSrc) {
				if (typeof propSrc !== "string") return null
				return typeof size === "number" ? getAvatarUrl(propSrc, size) : propSrc
			}

			return avatarSrc && typeof size === "number"
				? getAvatarUrl(avatarSrc, size)
				: avatarSrc || null
		}, [propSrc, size, avatarSrc])

		const fallbackText = useMemo(() => {
			const text = children || userInfo?.nickname || ""
			return typeof text === "string" ? text.slice(-1).toUpperCase() : ""
		}, [children, userInfo?.nickname])

		const textAvatarSrc = useMemo(() => {
			const text = children || userInfo?.nickname || ""
			if (typeof text !== "string" || !text) return DEFAULT_USER_ICON
			return (
				AvatarService.drawTextAvatar(
					text,
					style?.backgroundColor as string | undefined,
					style?.color as string | undefined,
				) || DEFAULT_USER_ICON
			)
		}, [children, userInfo?.nickname, style?.backgroundColor, style?.color])

		return (
			<Avatar
				className={cn(
					"shrink-0",
					shape === "square" ? "rounded-lg" : "rounded-full",
					onClick && "cursor-pointer",
					className,
				)}
				style={{
					width: size,
					height: size,
					...style,
				}}
				onClick={onClick}
				{...props}
			>
				<AvatarImage src={src || textAvatarSrc} alt={fallbackText} draggable={false} />
				<AvatarFallback
					className={cn(
						shape === "square" ? "rounded-lg" : "rounded-full",
						"flex items-center justify-center bg-muted",
					)}
				>
					{fallbackText || "U"}
				</AvatarFallback>
			</Avatar>
		)
	},
)

export default UserAvatarRender
