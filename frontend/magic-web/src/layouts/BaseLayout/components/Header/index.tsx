import { theme } from "antd"
import { magic } from "@/enhance/magicElectron"
import useDrag from "@/hooks/electron/useDrag"
import { observer } from "mobx-react-lite"
import HeaderActionSlot from "@/layouts/BaseLayout/components/Header/components/HeaderActionSlot"
import GlobalVersionStatus from "./components/GlobalVersionStatus"
import { MacMenu, WindowMenu, useDesktopVersionCheck } from "./components/DesktopMenu"
import { cn } from "@/utils/cn"

/**
 * Global search header component
 */
const Header = observer(function Header({ className }: { className?: string }) {
	const { onMouseDown } = useDrag()
	const { isHighVersion } = useDesktopVersionCheck()
	const { token } = theme.useToken()

	const isMac = !isHighVersion && magic?.env?.isMacOS?.()
	const isWin = !isHighVersion && magic?.env?.isWindows?.()

	return (
		<div
			className={cn(
				"flex w-full flex-none select-none items-center justify-between bg-transparent",
				"px-3 py-0",
				isMac && "!pl-[90px]",
				isWin && "!pr-[140px]",
				className,
			)}
			style={{
				height: token.titleBarHeight,
			}}
			onMouseDown={onMouseDown}
			onDoubleClick={() => magic?.view?.maximize?.()}
		>
			<MacMenu />
			<div className="mr-auto flex w-auto items-center gap-2.5">
				<GlobalVersionStatus />
			</div>
			<div className="ml-auto flex w-auto items-center gap-2.5">
				<HeaderActionSlot />
				<WindowMenu />
			</div>
		</div>
	)
})

export default Header
