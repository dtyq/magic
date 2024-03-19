import { Popup } from "antd-mobile"
import type { ReactNode } from "react"
import { memo, useMemo } from "react"
import { cx } from "antd-style"
import { useStyles } from "./styles"

export interface MobileNavigateMenuItemNoChildren {
	className?: string
	style?: React.CSSProperties
	key: string
	label?: ReactNode
	icon?: ReactNode
	onClick?: () => void
}

export interface MobileNavigateMenuItem extends MobileNavigateMenuItemNoChildren {
	children?: MobileNavigateMenuItemNoChildren[]
}

interface MobileNavigatePopupProps {
	items?: MobileNavigateMenuItem[]
	visible?: boolean
	onClose?: () => void
}

export default memo(function MobileNavigatePopup(props: MobileNavigatePopupProps) {
	const { items, visible, onClose } = props

	const { styles } = useStyles()

	const renderItems = useMemo(() => {
		return items
	}, [items])

	return (
		<Popup
			visible={visible}
			onMaskClick={onClose}
			onClose={onClose}
			position="right"
			bodyStyle={{
				width: "80dvw",
				borderRadius: "12px 0px 0px 12px",
			}}
		>
			<div className={styles.container}>
				{renderItems?.map((group) => {
					return (
						<div
							className={cx(styles.group, group.className)}
							style={group.style}
							key={group.key}
						>
							<div className={styles.groupName}>{group.label}</div>
							<div className={styles.groupActions}>
								{group.children?.map((item) => {
									return (
										<div
											className={cx(styles.actionItem, item.className)}
											style={item.style}
											key={item.key}
											onClick={item.onClick}
										>
											<div className={styles.iconWrapper}>{item.icon}</div>
											<div className={styles.name}>{item.label}</div>
										</div>
									)
								})}
							</div>
						</div>
					)
				})}
			</div>
		</Popup>
	)
})
