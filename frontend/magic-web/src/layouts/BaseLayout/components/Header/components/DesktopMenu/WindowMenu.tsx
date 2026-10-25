import { magic } from "@/enhance/magicElectron"
import { useEffect, useState } from "react"
import { IconX, IconMinus, IconSquares } from "@tabler/icons-react"
import { cn } from "@/utils/cn"
import { useDesktopVersionCheck } from "./useDesktopVersionCheck"

const menuIconClassName = cn(
	"inline-flex size-[30px] items-center justify-center rounded-[4px] text-foreground",
	"cursor-pointer hover:bg-foreground/[0.04]",
)

export function WindowMenu() {
	const { isHighVersion } = useDesktopVersionCheck()

	const [isActive, setActive] = useState(false)

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

	if (!(isHighVersion && magic?.env?.isWindows())) {
		return null
	}

	return (
		<div className="flex h-3 w-[100px] items-center justify-between" data-testid="window-menu">
			<span
				className={cn(menuIconClassName, !isActive && "text-foreground/40")}
				data-testid="window-menu-minimize-button"
				onClick={() => magic?.view?.minimize?.()}
			>
				<IconMinus size={20} strokeWidth={1.5} />
			</span>
			<span
				className={cn(menuIconClassName, !isActive && "text-foreground/40")}
				data-testid="window-menu-maximize-button"
				onClick={() => magic?.view?.maximize?.()}
			>
				<IconSquares size={20} strokeWidth={1.5} />
			</span>
			<span
				className={cn(
					menuIconClassName,
					"hover:bg-[#d53b2b] hover:text-white",
					!isActive && "text-foreground/40",
				)}
				data-testid="window-menu-close-button"
				onClick={() => magic?.view?.close?.()}
			>
				<IconX size={20} strokeWidth={1.5} />
			</span>
		</div>
	)
}
