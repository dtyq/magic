import { memo, useMemo } from "react"
import type { SettingPanelProps } from "./types"
import { useStyles } from "./styles"
import SettingSidebar from "./components/SettingSidebar"
import SettingHeader from "./components/SettingHeader"
import SettingContent from "./components/SettingContent"
import { useIsMobile } from "@/hooks/use-mobile"

function SettingPanel({
	menuItems,
	activeKey,
	onActiveKeyChange,
	renderContent,
	onClose,
	className,
	style,
}: SettingPanelProps) {
	const { styles, cx } = useStyles()
	const isMobile = useIsMobile()

	// Find active menu item for header
	const activeMenuItem = useMemo(() => {
		return menuItems.find((item) => item.key === activeKey)
	}, [menuItems, activeKey])

	return (
		<div className={cx(styles.container, className)} style={style}>
			{!isMobile && (
				<SettingSidebar
					menuItems={menuItems}
					activeKey={activeKey}
					onActiveKeyChange={onActiveKeyChange}
				/>
			)}
			<div className={styles.contentArea}>
				{activeMenuItem && (
					<SettingHeader
						title={activeMenuItem.label}
						subtitle={activeMenuItem.subtitle}
						icon={activeMenuItem.icon}
						background={activeMenuItem.background}
						onClose={onClose}
					/>
				)}
				<SettingContent>{renderContent(activeKey)}</SettingContent>
			</div>
		</div>
	)
}

export default memo(SettingPanel)
