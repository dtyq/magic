import MagicDropdown from "@/components/base/MagicDropdown"
import { useTranslation } from "react-i18next"
import MenuItem from "./components/MenuItem"
import { useGlobalMenuNavigate } from "./hooks"
import { useState } from "react"
import useMenuItems from "./hooks/useMenuItems"

function GlobalMenus({ children }: { children: React.ReactNode }) {
	const { t } = useTranslation("interface")

	const [open, setOpen] = useState(false)

	const menuItems = useMenuItems()
	const { handleMenuItemClick } = useGlobalMenuNavigate(() => setOpen(false))

	const renderPopup = () => (
		<div className="w-[348px] rounded-xl bg-white shadow-[0_6px_16px_0_rgba(0,0,0,0.08),0_3px_6px_-4px_rgba(0,0,0,0.12),0_9px_28px_8px_rgba(0,0,0,0.05)] dark:bg-neutral-800">
			<div className="m-0 grid grid-cols-3 gap-1.5 border-b border-border p-[18px] last:border-b-0">
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
