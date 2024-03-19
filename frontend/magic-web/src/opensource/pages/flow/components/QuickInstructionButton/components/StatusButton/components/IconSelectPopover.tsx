import MagicButton from "@/opensource/components/base/MagicButton"
import MagicIcon from "@/opensource/components/base/MagicIcon"
import { Flex, Form, Popover } from "antd"
import { useEffect, useMemo, useState } from "react"
import { observer } from "mobx-react-lite"
import { useMemoizedFn } from "ahooks"
import { botStore } from "@/opensource/stores/bot"
import { useTranslation } from "react-i18next"
import { useStyles } from "../../../styles"
import type { StatusIconKey } from "../../../StatusIcons"
import { DEFAULT_ICON } from "../../../const"
import { StatusIcons } from "@/opensource/pages/flow/components/QuickInstructionButton/components/StatusButton/components/StatusIcons"

interface IconSelectPopoverProps {
	name: number
	formIcon: StatusIconKey
	onChangeIcon: (index: number, icon: StatusIconKey) => void
}

const IconSelectPopover = observer(({ name, formIcon, onChangeIcon }: IconSelectPopoverProps) => {
	const { t } = useTranslation("interface")
	const { styles, cx } = useStyles()
	const [icon, setIcon] = useState<StatusIconKey>(formIcon)
	const instructStatusIcons = botStore.instructStatusIcons

	useEffect(() => {
		setIcon(formIcon)
	}, [formIcon, name])

	const onSelectIcon = useMemoizedFn((key: StatusIconKey) => {
		setIcon(key)
		onChangeIcon(name, key)
	})

	const content = useMemo(() => {
		return (
			<Flex gap={10} vertical>
				<MagicButton
					className={cx(styles.button, {
						[styles.selectedIconButton]: icon === "IconWand",
					})}
					type="text"
					onClick={() => onSelectIcon("IconWand")}
				>
					{t("explore.buttonText.useDefaultIcon")}
				</MagicButton>
				<div className={styles.iconGrid}>
					{instructStatusIcons.map((item: StatusIconKey) => (
						<MagicButton
							type="text"
							key={item}
							className={cx(styles.iconButton, {
								[styles.selectedIconButton]: item === icon,
							})}
							icon={
								<MagicIcon
									color="currentColor"
									size={16}
									component={StatusIcons[item]}
								/>
							}
							onClick={() => onSelectIcon(item)}
						/>
					))}
				</div>
			</Flex>
		)
	}, [
		cx,
		icon,
		instructStatusIcons,
		onSelectIcon,
		styles.button,
		styles.iconButton,
		styles.iconGrid,
		styles.selectedIconButton,
		t,
	])

	return (
		<Form.Item name={[name, "icon"]} initialValue={DEFAULT_ICON}>
			<Popover
				placement="top"
				content={content}
				trigger="click"
				overlayClassName={styles.iconPopover}
			>
				<MagicButton
					type="text"
					className={cx(styles.iconButton, styles.iconOuterButton)}
					icon={
						<MagicIcon color="currentColor" size={16} component={StatusIcons[icon]} />
					}
				/>
			</Popover>
		</Form.Item>
	)
})

export default IconSelectPopover
