import type { PopoverProps } from "antd"
import { Popover } from "antd"
import { IconDots } from "@tabler/icons-react"
import { useMemo, useState } from "react"
import MagicButton from "../MagicButton"
import useStyles from "./style"

export interface MenuItemConfig {
	key: string
	label: React.ReactNode
	danger?: boolean
	disabled?: boolean
	onClick?: (e: React.MouseEvent) => void
}

export interface MoreMenuProps extends PopoverProps {
	/** 是否使用图标 */
	useIcon?: boolean
	/** 图标 */
	Icon?: JSX.Element
	/** 菜单项（支持 ReactNode 或配置数组） */
	menuItems?: React.ReactNode | MenuItemConfig[]
}

const MoreMenu = ({
	useIcon = false,
	Icon,
	menuItems,
	children,
	className,
	...props
}: MoreMenuProps) => {
	const { styles } = useStyles()
	const [open, setOpen] = useState(false)

	const handleContextMenu = (event: React.MouseEvent) => {
		event.preventDefault() // 阻止默认右键菜单
		event.stopPropagation() // 右键菜单时阻止冒泡
	}

	const handleClickContent = (event: React.MouseEvent) => {
		setOpen(false)
		event.stopPropagation()
	}

	// 渲染菜单内容：支持配置数组或直接传入 ReactNode
	const renderMenuContent = useMemo(() => {
		if (!menuItems) return null

		// 如果是配置数组，渲染为按钮列表
		if (Array.isArray(menuItems)) {
			return menuItems.map((item) => (
				<MagicButton
					key={item.key}
					type="text"
					block
					justify="start"
					size="large"
					danger={item.danger}
					disabled={item.disabled}
					onClick={(e) => {
						item.onClick?.(e)
						setOpen(false)
					}}
				>
					{item.label}
				</MagicButton>
			))
		}

		// 否则直接渲染传入的 ReactNode（向后兼容）
		return menuItems
	}, [menuItems])

	return (
		<Popover
			overlayClassName={styles.popover}
			placement="bottomLeft"
			arrow={false}
			content={
				renderMenuContent && <div onClick={handleClickContent}>{renderMenuContent}</div>
			}
			trigger="click"
			autoAdjustOverflow
			open={open}
			onOpenChange={setOpen}
			{...props}
		>
			<div onContextMenu={handleContextMenu} className={className}>
				{useIcon &&
					(Icon || (
						<MagicButton
							type="text"
							icon={<IconDots color="currentColor" size={18} />}
						/>
					))}
				{children}
			</div>
		</Popover>
	)
}

export default MoreMenu
