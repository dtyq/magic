import { TabBar } from "antd-mobile"
import { memo, useMemo } from "react"
import { useLocation } from "react-router"
import { useStyles } from "./styles"
import useNavigate from "@/routes/hooks/useNavigate"

export interface TabBarItem {
	key: string
	icon: React.ReactNode
	activeIcon?: React.ReactNode
	title: string
	path: string
	hidden?: boolean
}

function getActiveKeyFromPath(pathname: string, items: TabBarItem[]): string | undefined {
	const item = items.find((item) => pathname.startsWith(item.path))
	return item?.key
}

const MobileTabBar = memo(({ tabItems }: { tabItems: TabBarItem[] }) => {
	const { styles } = useStyles()
	const location = useLocation()
	const navigate = useNavigate()

	const visibleItems = useMemo(() => tabItems.filter((item) => !item.hidden), [tabItems])

	const activeKey = useMemo(() => {
		return getActiveKeyFromPath(location.pathname, visibleItems)
	}, [location.pathname, visibleItems])

	const handleTabChange = (key: string) => {
		navigate({
			name: key,
			viewTransition: {
				direction: "left",
			},
			replace: true,
		})
	}

	if (visibleItems.length === 0) {
		return null
	}

	return (
		<TabBar className={styles.tabBar} activeKey={activeKey} onChange={handleTabChange}>
			{visibleItems.map((item) => (
				<TabBar.Item key={item.key} icon={item.icon} title={item.title} />
			))}
		</TabBar>
	)
})

export default MobileTabBar
