import { cn } from "@/opensource/lib/utils"
import { MacMenu } from "../Header/components/DesktopMenu/MacMenu"
import { WindowMenu } from "../Header/components/DesktopMenu/WindowMenu"
import useDrag from "@/opensource/hooks/electron/useDrag"
import { magic } from "@/opensource/enhance/magicElectron"

export default function ElectronHeader() {
	const { onMouseDown } = useDrag()
	// const isMac = !isHighVersion && magic?.env?.isMacOS?.()
	// const isWin = !isHighVersion && magic?.env?.isWindows?.()

	return (
		<div
			className={cn("flex h-10 items-center justify-between px-3")}
			onMouseDown={onMouseDown}
			onDoubleClick={() => magic?.view?.maximize?.()}
		>
			<MacMenu />
			<WindowMenu />
		</div>
	)
}
