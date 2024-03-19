import {
	useRef,
	useState,
	type PropsWithChildren,
	type PointerEvent,
	type MouseEvent,
	cloneElement,
} from "react"
import { Modal } from "antd"
import { observer } from "mobx-react-lite"
import MagicDropdown from "@/opensource/components/base/MagicDropdown"
import { UserMenuContent } from "./components"
import useUserMenu from "./hooks/useUserMenu"
import useMenuActions from "./hooks/useMenuActions"
import useUserMenusEffects from "./hooks/useUserMenusEffects"

interface UserMenusProps extends PropsWithChildren {
	isPreviewMode?: boolean
	initialOpen?: boolean
	placement?: string
}

const UserMenus = observer(function UserMenus({
	children,
	isPreviewMode,
	initialOpen = false,
	placement = "rightTop",
}: UserMenusProps) {
	const [, contextHolder] = Modal.useModal()
	const [open, setOpen] = useState(initialOpen)
	const ignoredTriggerRef = useRef(false)

	const { menu } = useUserMenu({ isPreviewMode })
	const { handleMenuClick } = useMenuActions({ onClose: () => setOpen(false) })

	useUserMenusEffects({ open })

	const shouldIgnoreTrigger = (target: EventTarget | null) => {
		return (
			target instanceof HTMLElement &&
			!!target.closest("[data-dropdown-ignore-trigger='true']")
		)
	}

	const handleTriggerPointerDownCapture = (e: PointerEvent<HTMLElement>) => {
		ignoredTriggerRef.current = shouldIgnoreTrigger(e.target)
	}

	const handleTriggerClickCapture = (e: MouseEvent<HTMLElement>) => {
		ignoredTriggerRef.current = shouldIgnoreTrigger(e.target)
	}

	const handleOpenChange = (nextOpen: boolean) => {
		if (nextOpen && ignoredTriggerRef.current) {
			ignoredTriggerRef.current = false
			return
		}

		ignoredTriggerRef.current = false
		setOpen(nextOpen)
	}

	const renderPopup = () => (
		<UserMenuContent menu={menu} onMenuClick={handleMenuClick} onClose={() => setOpen(false)} />
	)

	return (
		<>
			<MagicDropdown
				placement={placement}
				open={open}
				onOpenChange={handleOpenChange}
				trigger={["click"]}
				popupRender={renderPopup}
				overlayClassName="p-0 mb-2"
			>
				{children &&
					cloneElement(children as React.ReactElement, {
						"data-testid": "user-menus-trigger",
						onPointerDownCapture: handleTriggerPointerDownCapture,
						onClickCapture: handleTriggerClickCapture,
					})}
			</MagicDropdown>
			{contextHolder}
		</>
	)
})

export default UserMenus
