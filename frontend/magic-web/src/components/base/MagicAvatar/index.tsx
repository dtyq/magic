import type { AvatarProps, BadgeProps } from "antd"
import { Avatar, Badge } from "antd"
import { forwardRef, ReactNode, useEffect, useMemo, useState } from "react"
import AvatarService from "@/services/chat/avatar"
import { createStyles } from "antd-style"
import { useMemoizedFn } from "ahooks"
import userAvatarIcon from "@/assets/logos/user-avatar.svg"
import { getAvatarUrl } from "@/utils/avatar"

export interface MagicAvatarProps extends AvatarProps {
	badgeProps?: BadgeProps
	imgClassName?: string
	radius?: number
}

const useStyles = createStyles(({ token }, { radius }: { radius: number }) => ({
	avatar: {
		backgroundColor: token.magicColorScales.white,
		borderRadius: radius,
	},
}))

const getTextAvatar = (text: string | ReactNode, backgroundColor?: string, color?: string) => {
	const textString = typeof text === "string" ? text : ""
	if (textString === "") {
		return userAvatarIcon
	}
	return AvatarService.drawTextAvatar(textString, backgroundColor, color) ?? ""
}

const MagicAvatar = forwardRef<HTMLSpanElement, MagicAvatarProps>(
	(
		{
			children,
			src,
			size = 40,
			radius = 4,
			style,
			badgeProps,
			className,
			imgClassName,
			...props
		},
		ref,
	) => {
		const { styles, cx } = useStyles({ radius })

		const [innerSrc, setInnerSrc] = useState<string>(
			src && typeof src === "string"
				? src
				: getTextAvatar(children, style?.backgroundColor, style?.color),
		)

		useEffect(() => {
			setInnerSrc(
				typeof src === "string" && src
					? typeof size === "number"
						? getAvatarUrl(src, size)
						: src
					: getTextAvatar(children, style?.backgroundColor, style?.color),
			)
		}, [src, children, style?.backgroundColor, style?.color, size])

		const mergedStyle = useMemo(
			() => ({
				flex: "none",
				...style,
			}),
			[style],
		)

		const handleError = useMemoizedFn(() => {
			setInnerSrc(getTextAvatar(children, style?.backgroundColor, style?.color))
		})

		const srcNode = useMemo(() => {
			return (
				<img
					draggable={false}
					src={innerSrc}
					className={cx(styles.avatar, imgClassName)}
					alt={typeof children === "string" ? children : "avatar"}
					onError={handleError}
				/>
			)
		}, [cx, children, handleError, innerSrc, styles.avatar, imgClassName])

		const avatarContent = (
			<Avatar
				ref={ref}
				style={mergedStyle}
				size={size}
				shape="square"
				draggable={false}
				className={className}
				src={src && typeof src === "object" ? src : srcNode}
				{...props}
			/>
		)

		if (!badgeProps) {
			return avatarContent
		}

		return (
			<Badge offset={[-size, 0]} {...badgeProps}>
				{avatarContent}
			</Badge>
		)
	},
)

export default MagicAvatar
