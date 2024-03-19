import type { AvatarProps, BadgeProps } from "antd"
import { Avatar, Badge } from "antd"
import { useState, useEffect, type ReactNode, useMemo } from "react"
import { useMemoizedFn } from "ahooks"
import { useStyles } from "./style"
import { drawTextAvatar } from "./utils"

export interface MagicAvatarProps extends AvatarProps {
	children?: ReactNode
	border?: boolean
	badgeProps?: BadgeProps
	radius?: number
	imgClassName?: string
}
const getTextAvatar = (text: string | ReactNode, backgroundColor?: string, color?: string) => {
	const textString = typeof text === "string" ? text : "未知"
	return drawTextAvatar(textString, backgroundColor, color) ?? ""
}

const MagicAvatar = ({
	src,
	children,
	className,
	border = false,
	size = 42,
	radius = 4,
	style,
	badgeProps,
	imgClassName,
	...props
}: MagicAvatarProps) => {
	const { styles, cx } = useStyles({ radius })
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
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [children, handleError, innerSrc, imgClassName])

	const avatarContent = (
		<Avatar
			size={size}
			className={cx(styles.magicAvatar, className, { [styles.border]: border })}
			shape="square"
			src={src || srcNode}
			{...props}
		>
			{typeof children === "string" ? children.slice(0, 2) : children}
		</Avatar>
	)

	if (!badgeProps) {
		return avatarContent
	}

	return <Badge {...badgeProps}>{avatarContent}</Badge>
}

MagicAvatar.Group = Avatar.Group

export default MagicAvatar
