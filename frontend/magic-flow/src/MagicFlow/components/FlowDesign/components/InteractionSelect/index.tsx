import { prefix } from "@/MagicFlow/constants"
import { IconDeviceIpadHorizontal, IconMouse } from "@tabler/icons-react"
import { Flex } from "antd"
import clsx from "clsx"
import i18next from "i18next"
import React, { useMemo } from "react"
import { useTranslation } from "react-i18next"
import styles from "./index.module.less"

export enum Interactions {
	/** 鼠标友好模式 */
	Mouse = "mouse",
	/** 触控板友好模式 */
	TouchPad = "touch-pad",
}

type InteractionSelectProps = {
	interaction: Interactions
	onInteractionChange: (interaction: Interactions) => void
}

export default function InteractionSelect({
	onInteractionChange,
	interaction,
}: InteractionSelectProps) {
	const { t } = useTranslation()
	const interactionList = useMemo(() => {
		return [
			{
				icon: (
					<IconMouse
						size={60}
						className={clsx(styles.mouse, `${prefix}mouse`)}
						color="#1d1c23"
						stroke={1}
					/>
				),
				label: i18next.t("flow.mouseFriendly", { ns: "magicFlow" }),
				desc: i18next.t("flow.mouseFriendlyDesc", { ns: "magicFlow" }),
				value: Interactions.Mouse,
			},
			{
				icon: (
					<IconDeviceIpadHorizontal
						className={clsx(styles.touchPad, `${prefix}touch-pad`)}
						size={60}
						color="#1d1c23"
						stroke={1}
					/>
				),
				label: i18next.t("flow.touchpadFriendly", { ns: "magicFlow" }),
				desc: i18next.t("flow.touchpadFriendlyDesc", { ns: "magicFlow" }),
				value: Interactions.TouchPad,
			},
		]
	}, [])

	return (
		<div
			className={clsx(styles.interaction, `${prefix}interaction`)}
			onMouseOver={(e) => e.stopPropagation()}
			onMouseEnter={(e) => e.stopPropagation()}
		>
			<div className={clsx(styles.title, `${prefix}title`)}>
				{i18next.t("flow.interactionMode", { ns: "magicFlow" })}
			</div>
			<Flex className={clsx(styles.list, `${prefix}list`)}>
				{interactionList.map((item) => {
					return (
						<Flex
							className={clsx(styles.interactionItem, `${prefix}interaction-item`, {
								[styles.selected]: interaction === item.value,
								selected: interaction === item.value,
							})}
                            vertical
							align="center"
							onClick={() => onInteractionChange(item.value)}
						>
							{item.icon}
							<div className={clsx(styles.label, `${prefix}label`)}>{item.label}</div>
							<div className={clsx(styles.desc, `${prefix}desc`)}>{item.desc}</div>
						</Flex>
					)
				})}
			</Flex>
		</div>
	)
}
