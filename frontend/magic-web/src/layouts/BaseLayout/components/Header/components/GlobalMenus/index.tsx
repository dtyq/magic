import MagicDropdown from "@/components/base/MagicDropdown"
import { useTranslation } from "react-i18next"
import MenuItem from "./components/MenuItem"
import { useStyles } from "./styles"
import { useGlobalMenuNavigate } from "./hooks"
import { useState } from "react"
import useMenuItems from "./hooks/useMenuItems"

function GlobalMenus({ children }: { children: React.ReactNode }) {
	const { styles } = useStyles()
	const { t } = useTranslation("interface")

	const [open, setOpen] = useState(false)

	const menuItems = useMenuItems()
	const { handleMenuItemClick } = useGlobalMenuNavigate(() => setOpen(false))

	const renderPopup = () => (
		<div className={styles.popupContainer}>
			<div className={styles.menuGrid}>
				{menuItems.map((item) => (
					<MenuItem
						key={item.key}
						icon={item.icon}
						label={t(item.labelKey)}
						color={item.color}
						maskColor={item.maskColor}
						badge={item.badge}
						onClick={() => handleMenuItemClick(item.key)}
					/>
				))}
			</div>
		</div>
	)

	return (
		<MagicDropdown
			placement="right"
			popupRender={renderPopup}
			open={open}
			onOpenChange={setOpen}
			overlayClassName="p-0 mt-2"
			trigger={["click"]}
		>
			<span className="inline-flex">{children}</span>
		</MagicDropdown>
	)
}

export default GlobalMenus
