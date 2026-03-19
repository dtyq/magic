import { Flex, theme } from "antd"
import { magic } from "@/enhance/magicElectron"
import useDrag from "@/hooks/electron/useDrag"
import { observer } from "mobx-react-lite"
import HeaderActionSlot from "@/layouts/BaseLayout/components/Header/components/HeaderActionSlot"
import GlobalServiceStatus from "./components/GlobalServiceStatus"
import GlobalVersionStatus from "./components/GlobalVersionStatus"
import { MacMenu, WindowMenu, useDesktopVersionCheck } from "./components/DesktopMenu"
import { cn } from "@/lib/utils"

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
		<Flex
			className={cn(
				"w-full flex-none select-none items-center justify-between bg-transparent",
				"px-3 py-0",
				isMac && "!pl-[90px]",
				isWin && "!pr-[140px]",
				className,
			)}
			style={{
				height: token.titleBarHeight,
			}}
			align="center"
			onMouseDown={onMouseDown}
			onDoubleClick={() => magic?.view?.maximize?.()}
		>
			<MacMenu />
			<Flex className="mr-auto w-auto items-center" gap={10} align="center">
				<GlobalServiceStatus />
				<GlobalVersionStatus />
			</Flex>
			<Flex align="center" gap={10} className="ml-auto w-auto">
				<HeaderActionSlot />
				<WindowMenu />
			</Flex>
		</Flex>
	)
})

export default Header
