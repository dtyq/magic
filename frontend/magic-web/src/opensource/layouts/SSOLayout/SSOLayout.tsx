import { Outlet } from "react-router"
import useDrag from "@/opensource/hooks/electron/useDrag"
import { AnimatedGridPattern } from "@/opensource/layouts/SSOLayout/components/AnimatedGridPattern"
import Copyright from "@/opensource/components/other/Copyright"
import LanguageSelect from "@/opensource/layouts/SSOLayout/components/LanguageSelect"
import { Flex } from "antd"
import TopMeta from "@/opensource/layouts/SSOLayout/components/TopMeta"
import useLoginFormOverrideStyles from "@/opensource/styles/login-form-overrider"
import { useStyles } from "./styles"
import { withLoginService } from "./providers/LoginServiceProvider"
import { service } from "@/opensource/services"
import {
	WindowMenu,
	MacMenu,
} from "@/opensource/layouts/BaseLayout/components/Header/components/DesktopMenu"
import { lazy, Suspense } from "react"
import { cn } from "@/opensource/lib/utils"

const EditionActivitySlogan = lazy(
	() => import("@/opensource/components/business/EditionActivity/Slogan"),
)

export function Layout() {
	const { styles, cx } = useStyles()
	const { styles: loginFormOverrideStyles } = useLoginFormOverrideStyles()
	const { onMouseDown } = useDrag()

	return (
		<AnimatedGridPattern className={styles.layout} onMouseDown={onMouseDown}>
			<Flex className={styles.wrapper} align="center" justify="space-between">
				<Flex className={styles.main} vertical align="center">
					<Suspense fallback={null}>
						<EditionActivitySlogan />
					</Suspense>
					<Flex
						align="center"
						justify="flex-end"
						className={styles.header}
						style={{ width: "100%" }}
						gap={10}
					>
						<MacMenu className={styles.macMenu} />
						<LanguageSelect />
						<WindowMenu />
						{/* <AppearanceSwitch /> */}
					</Flex>
					<Flex vertical align="center" className={styles.content}>
						<TopMeta />
						<Flex
							vertical
							align="center"
							className={cx(styles.container, loginFormOverrideStyles.container)}
						>
							<Outlet />
						</Flex>
					</Flex>
					<Copyright />
				</Flex>
			</Flex>
		</AnimatedGridPattern>
	)
}

export default withLoginService(
	function SSOLayout() {
		return <Layout />
	},
	{
		service,
		autoSyncWhenGlobalClusterCodeChanged: true,
	},
)
