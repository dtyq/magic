import React, { memo } from "react"
import { Radio, RadioChangeEvent } from "antd"
import clsx from "clsx"
import { prefix } from "@/MagicFlow/constants"
import styles from "../../index.module.less"

interface TabItem {
	value: string
	label: React.ReactNode
	onClick: () => void
}

interface PanelHeaderProps {
	materialHeader?: React.ReactNode
	tabList: TabItem[]
	tab: string
}

const PanelHeader: React.FC<PanelHeaderProps> = memo(
	({ materialHeader, tabList, tab }: PanelHeaderProps) => {
		if (materialHeader) {
			return <>{materialHeader}</>
		}

		// 处理Radio.Group的onChange事件
		const handleChange = (e: RadioChangeEvent) => {
			const value = e.target.value
			// 找到对应的tabItem并触发其onClick
			const tabItem = tabList.find((item) => item.value === value)
			tabItem?.onClick()
		}

		return (
			<Radio.Group value={tab} buttonStyle="solid" onChange={handleChange}>
				{tabList.map((tabItem, i) => {
					return (
						<Radio.Button
							className={clsx(styles.tabItem, `${prefix}tab-item`, {
								[styles.active]: tab === tabItem.value,
								active: tab === tabItem.value,
							})}
							key={i}
							value={tabItem.value}
						>
							{tabItem.label}
						</Radio.Button>
					)
				})}
			</Radio.Group>
		)
	},
)

export default PanelHeader
