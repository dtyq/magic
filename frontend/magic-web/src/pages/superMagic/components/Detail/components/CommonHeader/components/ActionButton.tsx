import { Flex, Spin } from "antd"
import { isValidElement, memo } from "react"
import type { ForwardRefExoticComponent, RefAttributes } from "react"
import type { Icon, IconProps } from "@tabler/icons-react"
import MagicIcon from "@/components/base/MagicIcon"
import { cn } from "@/utils/cn"
import ConditionalTooltip from "../../EditToolbar/ConditionalTooltip"

interface ActionButtonProps {
	id?: string
	"data-testid"?: string
	icon?:
		| ForwardRefExoticComponent<Omit<IconProps, "ref"> & RefAttributes<Icon>>
		| React.ReactNode
		| null
	rightIcon?:
		| ForwardRefExoticComponent<Omit<IconProps, "ref"> & RefAttributes<Icon>>
		| React.ReactNode
		| null
	icon_url?: string
	element?: React.ReactNode
	title?: string
	text?: string
	onClick?: () => void
	disabled?: boolean
	loading?: boolean
	className?: string
	size?: number
	rightIconSize?: number
	stroke?: number
	showText?: boolean
	textClassName?: string
	style?: React.CSSProperties
	gap?: number
	/** 全屏等场景下将 Tooltip 挂载到指定容器内 */
	getPopupContainer?: () => HTMLElement | null
}

export default memo(function ActionButton({
	id,
	"data-testid": dataTestId,
	icon,
	element,
	rightIcon,
	title,
	text,
	onClick,
	disabled = false,
	loading = false,
	className = "",
	size = 18,
	rightIconSize,
	stroke = 1.25,
	showText = true,
	icon_url,
	textClassName,
	style,
	gap = 4,
	getPopupContainer,
}: ActionButtonProps) {
	const isDisabled = disabled || loading
	// 尺寸变量只由业务标题栏按需提供；没有设置时保持已有按钮的字号、间距与高度。
	const iconCommonClasses = cn(
		"cursor-pointer rounded-[10px] stroke-muted-foreground",
		isDisabled && "cursor-not-allowed opacity-50",
		className,
	)

	return (
		<ConditionalTooltip
			showText={showText}
			title={title || text || ""}
			getPopupContainer={getPopupContainer}
		>
			<Flex
				id={id}
				data-testid={dataTestId}
				gap={showText ? `var(--detail-action-gap, ${gap}px)` : 0}
				align="center"
				style={style}
				onClick={isDisabled ? undefined : onClick}
				title={title}
				className={cn(
					"h-[var(--detail-action-height,1.5rem)] min-w-[var(--detail-action-height,auto)] select-none rounded-lg px-1.5 text-foreground transition-colors",
					isDisabled
						? "cursor-not-allowed"
						: "cursor-pointer hover:bg-accent active:bg-accent/80",
				)}
			>
				{loading ? (
					<Spin size="small" />
				) : element ? (
					element
				) : icon ? (
					isValidElement(icon) ? (
						<span className={iconCommonClasses}>{icon}</span>
					) : (
						<MagicIcon
							size={size}
							component={
								icon as ForwardRefExoticComponent<
									Omit<IconProps, "ref"> & RefAttributes<Icon>
								>
							}
							stroke={stroke}
							className={iconCommonClasses}
						/>
					)
				) : (
					<img
						src={icon_url}
						alt="icon"
						className={iconCommonClasses}
						style={{ width: size, height: size }}
						data-testid="action-button-image"
					/>
				)}
				{text && !loading && (
					<span
						className={cn(
							"inline-block overflow-hidden text-[length:var(--detail-action-font-size,0.75rem)] leading-[var(--detail-action-line-height,0.75rem)]",
							"whitespace-nowrap transition-[max-width,opacity,transform] duration-150",
							"text-foreground ease-in-out will-change-[max-width,opacity,transform]",
							showText
								? "max-w-[140px] translate-x-0 opacity-100"
								: "max-w-0 -translate-x-0.5 opacity-0",
							textClassName,
						)}
					>
						{text}
					</span>
				)}
				{rightIcon &&
					showText &&
					!loading &&
					(isValidElement(rightIcon) ? (
						<span>{rightIcon}</span>
					) : (
						<MagicIcon
							size={rightIconSize || size}
							component={
								rightIcon as ForwardRefExoticComponent<
									Omit<IconProps, "ref"> & RefAttributes<Icon>
								>
							}
							stroke={stroke}
						/>
					))}
			</Flex>
		</ConditionalTooltip>
	)
})
