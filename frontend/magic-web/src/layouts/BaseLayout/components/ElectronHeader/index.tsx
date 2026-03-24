import { cn } from "@/lib/utils"
import { MacMenu } from "../Header/components/DesktopMenu/MacMenu"
import { WindowMenu } from "../Header/components/DesktopMenu/WindowMenu"
import { useDesktopVersionCheck } from "../Header/components/DesktopMenu"
import useDrag from "@/hooks/electron/useDrag"
import { magic } from "@/enhance/magicElectron"

export default function ElectronHeader() {
	const { onMouseDown } = useDrag()
	const { isHighVersion } = useDesktopVersionCheck()
	const isMac = isHighVersion && magic?.env?.isMacOS?.()
	const isWin = isHighVersion && magic?.env?.isWindows?.()

	return (
		<div
			className={cn(
				"flex h-10 items-center gap-2 px-3",
				isMac && "justify-start",
				isWin && "justify-end",
			)}
			onMouseDown={onMouseDown}
			onDoubleClick={() => magic?.view?.maximize?.()}
		>
			<MacMenu />
			<WindowMenu />
		</div>
	)
}
