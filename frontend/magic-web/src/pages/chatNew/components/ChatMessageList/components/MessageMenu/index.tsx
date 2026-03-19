import MagicDropdown from "@/components/base/MagicDropdown"
import MagicIcon from "@/components/base/MagicIcon"
import MessageDropdownService from "@/services/chat/message/MessageDropdownService"
import { t } from "i18next"
import { createStyles } from "antd-style"

import MessageDropdownStore from "@/stores/chatNew/messageUI/Dropdown"
import { memo, useEffect, useRef } from "react"
import { useIsMobile } from "@/hooks/useIsMobile"
import { useSize } from "ahooks"

interface MessageMenuProps {
	open: boolean
	dropdownPosition: { x: number; y: number }
	setDropdownSize: (size: { width: number; height: number }) => void
	onClose?: () => void
}

const useStyles = createStyles(({ css }) => {
	return {
		dropdownMenu: css`
			min-width: 100px;
			width: fit-content;
		`,
	}
})

const MessageMenu = memo(
	function MessageMenu({ open, dropdownPosition, setDropdownSize, onClose }: MessageMenuProps) {
		const { styles } = useStyles()
		const isMobile = useIsMobile()
		const dropdownRef = useRef<HTMLDivElement>(null)
		const size = useSize(dropdownRef)

		useEffect(() => {
			if (size && open) {
				setDropdownSize({
					width: size.width,
					height: size.height,
				})
			}
		}, [size, setDropdownSize, open])

		const handleMenuItemClick = (key: string) => {
			// Execute the menu item action
			MessageDropdownService.clickMenuItem(key as any)
			// Close the menu after action
			onClose?.()
		}

		return (
			<MagicDropdown
				className="message-item-menu"
				autoAdjustOverflow
				open={open}
				overlayClassName={styles.dropdownMenu}
				trigger={[]}
				overlayStyle={{
					position: "fixed",
					left: dropdownPosition.x,
					top: dropdownPosition.y,
				}}
				onOpenChange={(visible) => {
					// Ensure menu closes when visibility changes
					if (!visible) {
						onClose?.()
					}
				}}
				menu={{
					items: MessageDropdownStore.menu.map((item) => {
						if (item.key.startsWith("divider")) {
							return {
								key: item.key,
								type: "divider",
							}
						}
						return {
							icon: item.icon ? (
								<MagicIcon
									color={item.icon.color}
									component={item.icon.component as any}
									size={item.icon.size}
								/>
							) : undefined,
							key: item.key,
							label: t(item.label ?? "", { ns: "interface" }),
							danger: item.danger,
							onClick: ({ domEvent }) => {
								domEvent?.stopPropagation()
								handleMenuItemClick(item.key)
							},
						}
					}),
				}}
			>
				<div style={{ display: "none" }} />
			</MagicDropdown>
		)
	},
	(prevProps, nextProps) => {
		return (
			prevProps.open === nextProps.open &&
			prevProps.dropdownPosition.x === nextProps.dropdownPosition.x &&
			prevProps.dropdownPosition.y === nextProps.dropdownPosition.y &&
			prevProps.onClose === nextProps.onClose
		)
	},
)

export default MessageMenu
