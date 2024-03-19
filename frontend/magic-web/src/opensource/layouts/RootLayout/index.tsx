import { memo, Suspense } from "react"
import { Outlet } from "react-router-dom"
import { Flex } from "antd"
import MagicSpin from "@/opensource/components/base/MagicSpin"
import { createStyles } from "antd-style"

const useStyles = createStyles(({ css }) => ({
	rootLayout: css`
		width: 100%;
		height: 100%;
	`,
}))

function RootLayout() {
	const { styles } = useStyles()

	return (
		<div className={styles.rootLayout}>
			<Suspense
				fallback={
					<Flex
						flex={1}
						vertical
						align="center"
						justify="center"
						style={{ width: "100%", height: "90vh" }}
					>
						<MagicSpin spinning />
					</Flex>
				}
			>
				<Outlet />
			</Suspense>
		</div>
	)
}

export default memo(RootLayout)
