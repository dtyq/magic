import { Flex, theme } from "antd"
import { observer } from "mobx-react-lite"
import GlobalServiceStatus from "@/opensource/layouts/BaseLayout/components/Header/components/GlobalServiceStatus"
import GlobalVersionStatus from "@/opensource/layouts/BaseLayout/components/Header/components/GlobalVersionStatus"
import { cn } from "@/opensource/lib/utils"
import HeaderExtraSlot from "./HeaderExtraSlot"
import WorkspaceSwitcher from "./WorkspaceSwitcher"

/**
 * Global search header component
 */
const Header = observer(function Header({ className }: { className?: string }) {
	const { token } = theme.useToken()

	return (
		<Flex
			className={cn(
				"w-full flex-none select-none items-center justify-between bg-transparent",
				"px-3 py-0",
				className,
			)}
			style={{
				height: token.titleBarHeight,
			}}
			align="center"
		>
			<Flex className="mr-auto w-auto items-center" gap={10} align="center">
				<WorkspaceSwitcher />
				<GlobalServiceStatus />
				<GlobalVersionStatus />
			</Flex>
			<Flex align="center" gap={10} className="ml-auto w-auto">
				<HeaderExtraSlot />
			</Flex>
		</Flex>
	)
})

export default Header
