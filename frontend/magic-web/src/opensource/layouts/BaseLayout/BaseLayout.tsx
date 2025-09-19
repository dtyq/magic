import { Flex } from "antd"
import { memo, useRef } from "react"
import { useNavigate } from "@/opensource/hooks/useNavigate"
import { useMemoizedFn, useMount, useSize } from "ahooks"
import { RoutePath } from "@/const/routes"
import NetworkTip from "@/opensource/components/other/NetworkTip"
import GlobalChatProvider from "@/opensource/providers/ChatProvider"
import FlowProvider from "@/opensource/providers/FlowProvider"
import AuthenticationProvider from "@/opensource/providers/AuthenticationProvider"
import MemberCard from "@/opensource/components/business/MemberCard"
import MemberCardStore from "@/opensource/stores/display/MemberCardStore"
import { observer } from "mobx-react-lite"
import Header from "./components/Header"
import Sider from "./components/Sider"
import { useStyles } from "./styles"
import { useSideMenu } from "./components/Sider/hooks"
import { useKeepAlive } from "@/opensource/hooks/router/useKeepAlive"

const BaseLayout = observer(() => {
	const siderRef = useRef<HTMLDivElement | null>(null)
	const siderSize = useSize(siderRef)
	const { styles } = useStyles({ siderSize })
	const navigate = useNavigate()

	const pageMenuItems = useSideMenu()

	const { Content } = useKeepAlive()

	useMount(() => {
		if (window.location.pathname === "/") {
			navigate(RoutePath.Chat)
		}
	})

	const handleClick = useMemoizedFn((e: React.MouseEvent<HTMLDivElement>) => {
		const target = e.target as HTMLElement
		if (target.closest(`.${MemberCardStore.domClassName}`)) {
			const memberCard = target.closest(`.${MemberCardStore.domClassName}`)
			const uid = MemberCardStore.getUidFromElement(memberCard as HTMLElement)
			if (uid) {
				MemberCardStore.openCard(uid, { x: e.clientX, y: e.clientY })
			}
		}
		// 点击卡片外其他区域，关闭成员卡片
		else if (MemberCardStore.open) {
			MemberCardStore.closeCard()
		}
	})

	return (
		<Flex vertical className={styles.global} onClick={handleClick}>
			<Header className={styles.header} />
			<NetworkTip />
			<Flex className={styles.globalWrapper}>
				<Sider ref={siderRef} className={styles.sider} menuItems={pageMenuItems} />
				<div className={styles.content}>{Content}</div>
			</Flex>
			<MemberCard />
		</Flex>
	)
})

const ProviderWrapper = memo(function ProviderWrapper() {
	return (
		<AuthenticationProvider>
			<GlobalChatProvider>
				<FlowProvider>
					<BaseLayout />
				</FlowProvider>
			</GlobalChatProvider>
		</AuthenticationProvider>
	)
})

export default ProviderWrapper
