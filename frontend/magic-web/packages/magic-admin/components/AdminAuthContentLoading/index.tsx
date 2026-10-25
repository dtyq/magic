import { Flex } from "antd"
import MagicSpin from "../MagicSpin"

interface AdminAuthContentLoadingProps {
	fullScreen?: boolean
}

function AdminAuthContentLoading({ fullScreen = false }: AdminAuthContentLoadingProps) {
	return (
		<Flex
			justify="center"
			align="center"
			style={
				fullScreen
					? { height: "100vh", width: "100vw" }
					: { height: "100%", width: "100%", minHeight: 320 }
			}
		>
			<MagicSpin spinning />
		</Flex>
	)
}

export default AdminAuthContentLoading
