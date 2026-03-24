import { Flex, theme } from "antd"
import { observer } from "mobx-react-lite"
import GlobalServiceStatus from "@/layouts/BaseLayout/components/Header/components/GlobalServiceStatus"
import GlobalVersionStatus from "@/layouts/BaseLayout/components/Header/components/GlobalVersionStatus"
import { cn } from "@/lib/utils"
import HeaderExtraSlot from "../AgentsPage/components/HeaderExtraSlot"

/**
 * Same bar as AgentsPage Header, without workspace switcher.
 */
export const MagiClawHeader = observer(function MagiClawHeader({
	className,
}: {
	className?: string
}) {
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
				<GlobalServiceStatus />
				<GlobalVersionStatus />
			</Flex>
			<Flex align="center" gap={10} className="ml-auto w-auto">
				<HeaderExtraSlot />
			</Flex>
		</Flex>
	)
})
