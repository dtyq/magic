import { useMemoizedFn } from "ahooks"
import { useStyles } from "./styles"
import type { TopicModeTabsProps } from "./types"
import { TopicMode } from "../../../../pages/Workspace/types"
import { useModeList } from "../../hooks/usePatternTabs"
import FlexBox from "@/opensource/components/base/FlexBox"
import { memo } from "react"
import IconComponent from "@/opensource/pages/superMagic/components/IconViewComponent/index"

const TopicModeTabsMobile = ({ onModeChange, visible }: TopicModeTabsProps) => {
	const { styles, cx } = useStyles()

	// 话题模式tabs
	const { modeList } = useModeList({ includeGeneral: false, includeChat: false })

	// 处理模式切换
	const handleModeChange = useMemoizedFn((mode: TopicMode) => {
		onModeChange(mode)
	})

	if (!visible) {
		return null
	}

	return (
		<FlexBox gap={6} align="center" justify="left" className={styles.tabsWrapper}>
			{modeList.map((tab) => (
				<div
					key={tab.mode.identifier}
					className={styles.tabItem}
					onClick={() => handleModeChange(tab.mode.identifier as TopicMode)}
				>
					<div className={cx(styles.tabTitle)}>
						{/* {IconComponent(tab.mode.icon, 20)} */}
						<IconComponent
							iconType={tab.mode.icon_type}
							iconUrl={tab.mode.icon_url}
							selectedIcon={tab.mode.icon}
							size={16}
							iconColor={tab.mode.color}
						/>
						<div>{tab.mode.name}</div>
					</div>
				</div>
			))}
		</FlexBox>
	)
}

export default memo(TopicModeTabsMobile)
