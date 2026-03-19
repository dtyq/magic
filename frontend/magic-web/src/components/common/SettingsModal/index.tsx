import { useStyles } from "./styles"
import {
	useMemo,
	useState,
	createElement,
	isValidElement,
	cloneElement,
	type ReactElement,
} from "react"
import { IconX } from "@tabler/icons-react"
import type { SettingsModalProps, SettingsModalChildrenProps } from "./types"
import { useResponsive } from "ahooks"
import { Tabs } from "antd-mobile"
import { useTranslation } from "react-i18next"

export default function SettingsModal(props: SettingsModalProps) {
	const { t } = useTranslation("super")
	const { onClose, tabs, defaultTab } = props

	const { styles, cx } = useStyles()
	const { md } = useResponsive()
	const isMobile = !md

	const [activeTab, setActiveTab] = useState(defaultTab || tabs[0]?.key)

	const currentPanel = useMemo(() => {
		const tab = tabs.find((t) => t.key === activeTab)
		const child: ReactElement<SettingsModalChildrenProps> | undefined = tab?.component
		return (
			<div className={styles.wrapper}>
				{child && isValidElement(child) && cloneElement(child, { onClose })}
			</div>
		)
	}, [tabs, activeTab, onClose, styles.wrapper])

	if (isMobile) {
		return (
			<div className={styles.mobileLayout}>
				<div className={styles.mobileHeader}>
					<Tabs onChange={(e) => setActiveTab(e as string)}>
						{tabs.map((tab) => {
							return (
								<Tabs.Tab
									title={
										<div
											className={cx(styles.panelItem, {
												[styles.mobileActive]: tab.key === activeTab,
											})}
										>
											{tab?.icon && createElement(tab.icon, { size: 16 })}
											<span>{tab?.label}</span>
										</div>
									}
									key={tab.key}
								/>
							)
						})}
					</Tabs>
					<div className={styles.headerClose} onClick={onClose}>
						<IconX size={24} />
					</div>
				</div>
				{currentPanel}
			</div>
		)
	}

	return (
		<div className={styles.layout}>
			<div className={styles.panel}>
				<div className={styles.panelGroup}>
					<div className={styles.panelHeader}>{t("shareManagement.title")}</div>
					{tabs.map((tab) => {
						return (
							<div
								key={tab.key}
								onClick={() => setActiveTab(tab.key)}
								className={cx(styles.panelItem, {
									[styles.active]: tab.key === activeTab,
								})}
							>
								{tab?.icon && createElement(tab.icon, { size: 16 })}
								{tab.label}
							</div>
						)
					})}
				</div>
			</div>
			{currentPanel}
		</div>
	)
}
