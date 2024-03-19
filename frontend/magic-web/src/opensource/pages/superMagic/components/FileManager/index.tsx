import { useMemo, useState } from "react"
import { cx } from "antd-style"
import MarkedFIle from "@/opensource/pages/superMagic/assets/svg/marked_file.svg"
import ShareThread from "@/opensource/pages/superMagic/assets/svg/share_thread.svg"
import ShareWebSite from "@/opensource/pages/superMagic/assets/svg/share_website.svg"
import MarkedFiles from "../MarkedFiles"
import SharedTopics from "../SharedTopics"
import DeployedWebsites from "../DeployedWebsites"
import { useStyles } from "./styles"

const FileManager: React.FC = () => {
	const { styles } = useStyles()

	const [activeTabKey, setActiveTabKey] = useState<string>("1")

	// 定义Tab项
	const tabItems = useMemo(() => {
		return [
			{
				key: "1",
				label: "标记的文件",
				icon: MarkedFIle,
				children: <MarkedFiles />,
			},
			{
				key: "2",
				label: "分享的话题",
				icon: ShareThread,
				children: <SharedTopics />,
			},
			{
				key: "3",
				label: "创建的网站",
				icon: ShareWebSite,
				children: <DeployedWebsites />,
			},
		]
	}, [])

	// 处理Tab切换
	const handleTabChange = (key: string) => {
		setActiveTabKey(key)
	}

	// 获取当前活动Tab的内容
	const getActiveTabContent = () => {
		const activeTab = tabItems.find((item) => item.key === activeTabKey)
		return activeTab ? activeTab.children : null
	}

	const isActiveFirstTab = activeTabKey === tabItems[0].key

	return (
		<div className={styles.container}>
			<ul className={styles.tabsList}>
				{tabItems.map((item) => (
					<button
						key={item.key}
						className={cx(
							styles.tabItem,
							activeTabKey === item.key && styles.tabItemActive,
						)}
						onClick={() => handleTabChange(item.key)}
						type="button"
					>
						<img src={item.icon} className={styles.tabIcon} alt="" />
						{item.label}
					</button>
				))}
			</ul>
			<div
				className={cx(
					styles.tabContent,
					isActiveFirstTab && styles.tabContentActiveFirstTab,
				)}
			>
				{getActiveTabContent()}
			</div>
		</div>
	)
}

export default FileManager
