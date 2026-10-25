import { magic } from "@/enhance/magicElectron"
import { useEffect, useState } from "react"
import { IconMinus } from "@tabler/icons-react"
import { IconClose, IconToggle } from "@/enhance/tabler/icons-react"
import { cn } from "@/utils/cn"
import { useDesktopVersionCheck } from "./useDesktopVersionCheck"

const menuIconClassName =
	"inline-flex size-3 cursor-pointer items-center justify-center rounded-full"

// Match native macOS titlebar controls by revealing the traffic-light glyphs only on hover.
const menuClassName =
	"flex h-3 w-[60px] items-center justify-start gap-2 [&_svg]:opacity-0 hover:[&_svg]:opacity-100"

interface MacMenuProps {
	className?: string
}

export function MacMenu(props?: MacMenuProps) {
	const { isHighVersion } = useDesktopVersionCheck()

	const [isActive, setActive] = useState(true)

	useEffect(() => {
		const onBlur = () => {
			setActive(false)
		}
		const onFocus = () => {
			setActive(true)
		}
		window.addEventListener("focus", onFocus)
		window.addEventListener("blur", onBlur)

		return () => {
			window.removeEventListener("focus", onFocus)
			window.removeEventListener("blur", onBlur)
		}
	}, [])

	if (!(isHighVersion && magic?.env?.isMacOS())) {
		return null
	}

	return (
		<div className={cn(menuClassName, props?.className)} data-testid="mac-menu">
			<span
				className={cn(menuIconClassName, isActive ? "bg-[#ff5f57]" : "bg-foreground/10")}
				data-testid="mac-menu-close-button"
				onClick={() => magic?.view?.close?.()}
			>
				<IconClose size={8} />
			</span>
			<span
				className={cn(menuIconClassName, isActive ? "bg-[#febc2e]" : "bg-foreground/10")}
				data-testid="mac-menu-minimize-button"
				onClick={() => magic?.view?.minimize?.()}
			>
				<IconMinus size={8} />
			</span>
			<span
				className={cn(menuIconClassName, isActive ? "bg-[#28c840]" : "bg-foreground/10")}
				data-testid="mac-menu-maximize-button"
				onClick={() => magic?.view?.maximize?.()}
			>
				<IconToggle size={6} />
			</span>
		</div>
	)
}
