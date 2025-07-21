import type { AvatarProps, BadgeProps } from "antd"
import { Avatar, Badge } from "antd"
import { forwardRef, ReactNode, useEffect, useMemo, useState } from "react"
import { drawTextAvatar } from "./utils"
import { createStyles } from "antd-style"
import { useMemoizedFn } from "ahooks"

export interface MagicAvatarProps extends AvatarProps {
	badgeProps?: BadgeProps
}

const useStyles = createStyles(({ token }) => ({
	avatar: {
		backgroundColor: token.magicColorScales.white,
	},
}))

const getTextAvatar = (text: string | ReactNode, backgroundColor?: string, color?: string) => {
	const textString = typeof text === "string" ? text : "未知"
	return drawTextAvatar(textString, backgroundColor, color) ?? ""
}

const MagicAvatar = forwardRef<HTMLSpanElement, MagicAvatarProps>(
	({ children, src, size = 40, style, badgeProps, className, ...props }, ref) => {
		const { styles } = useStyles()

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
					src={innerSrc}
					className={styles.avatar}
					alt={typeof children === "string" ? children : "avatar"}
					onError={handleError}
				/>
			)
		}, [children, handleError, innerSrc, styles.avatar])

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

MagicAvatar.displayName = "MagicAvatar"

export default MagicAvatar
