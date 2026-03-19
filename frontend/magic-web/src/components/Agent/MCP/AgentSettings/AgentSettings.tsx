import { useStyles } from "./styles"
import { useMemo, useState, createElement, isValidElement, cloneElement, ReactElement } from "react"
import { MCPPanel } from "./AgentPanel"
import {
	/** IconClockPlay, IconMailShare, IconHeart, */ IconX,
	IconPlug,
} from "@tabler/icons-react"
import type { AgentCommonModalChildrenProps } from "../../AgentCommonModal"
import { useTranslation } from "react-i18next"
import { useResponsive } from "ahooks"
import { Tabs } from "antd-mobile"

export const enum PanelType {
	MCP = "MCP",
	// ScheduledTasks = "ScheduledTasks",
}

export interface AgentCommonProps extends AgentCommonModalChildrenProps {
	defaultPanel?: PanelType
	/** Storage value (affected by the business scope of MCP, currently it needs to be associated with the Super Maggie project when using MCP configuration in Super Maggie) */
	storageKey?: string
	onSuccessCallback?: () => void
	/** 是否使用临时存储模式 */
	useTempStorage?: boolean
}

export default function AgentSettings(props: AgentCommonProps) {
	const { onClose, defaultPanel, storageKey, onSuccessCallback, useTempStorage } = props

	const { styles, cx } = useStyles()
	const { t } = useTranslation("agent")
	const { md } = useResponsive()
	const isMobile = !md

	const [panelType, setPanelType] = useState(defaultPanel || PanelType.MCP)

	const menu = useMemo(() => {
		return {
			[PanelType.MCP]: {
				key: PanelType.MCP,
				label: t("common.settings.mcp"),
				icon: IconPlug,
				component: (
					<MCPPanel
						onSuccessCallback={onSuccessCallback}
						storageKey={storageKey}
						useTempStorage={useTempStorage}
					/>
				),
			},
			// [PanelType.ScheduledTasks]: {
			// 	key: PanelType.ScheduledTasks,
			// 	icon: IconClockPlay,
			// 	label: t("common.settings.tasks"),
			// 	component: ScheduledTasksPanel,
			// },
		}
	}, [onSuccessCallback, storageKey, t, useTempStorage])

	const panel = useMemo(() => {
		const child: ReactElement<AgentCommonModalChildrenProps> = menu[panelType]?.component
		return (
			<div className={styles.wrapper}>
				{child && isValidElement(child) && cloneElement(child, { onClose })}
			</div>
		)
	}, [menu, onClose, panelType, styles.wrapper])

	if (isMobile) {
		return (
			<div className={styles.mobileLayout}>
				<div className={styles.mobileHeader}>
					<Tabs onChange={(e) => setPanelType(e as PanelType)}>
						{(Object.keys(menu) as Array<keyof typeof menu>).map((key) => {
							const o = menu[key]
							return (
								<Tabs.Tab
									title={
										<div
											className={cx(styles.panelItem, {
												[styles.mobileActive]: key === panelType,
											})}
										>
											{o?.icon && createElement(o.icon, { size: 16 })}
											<span>{o?.label}</span>
										</div>
									}
									key={o.key}
								/>
							)
						})}
					</Tabs>
					<div className={styles.headerClose} onClick={onClose}>
						<IconX size={24} />
					</div>
				</div>
				{panel}
			</div>
		)
	}

	return (
		<div className={styles.layout}>
			<div className={styles.panel}>
				{/*<div className={styles.panelGroup}>*/}
				{/*	<div className={styles.panelHeader}>{t("common.settings.title")}</div>*/}
				{/*	<div className={styles.panelItem}>*/}
				{/*		<IconHeart size={16} />*/}
				{/*		{t("common.settings.usage")}*/}
				{/*	</div>*/}
				{/*</div>*/}
				<div className={styles.panelGroup}>
					<div className={styles.panelHeader}>{t("common.settings.func")}</div>
					{(Object.keys(menu) as Array<keyof typeof menu>).map((key) => {
						const item = menu[key]
						return (
							<div
								key={key}
								onClick={() => setPanelType(key)}
								className={cx(styles.panelItem, {
									[styles.active]: key === panelType,
								})}
							>
								{item?.icon && createElement(item.icon, { size: 16 })}
								{item.label}
							</div>
						)
					})}
				</div>
				{/*<div className={cx(styles.panelItem, styles.paneFooter)}>*/}
				{/*	<IconMailShare size={16} />*/}
				{/*	{t("common.settings.contact")}*/}
				{/*</div>*/}
			</div>
			{panel}
		</div>
	)
}
