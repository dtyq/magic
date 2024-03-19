import { Flex, Popover, Tooltip } from "antd"
import { IconBugFilled, IconChevronDown } from "@tabler/icons-react"
import clsx from "clsx"
import i18next from "i18next"
import React, { memo } from "react"
import { prefix } from "@/MagicFlow/constants"
import FlowPopup from "@/MagicFlow/components/FlowPopup"
import TextEditable from "../../common/components/TextEditable"
import styles from "../index.module.less"

interface NodeHeaderProps {
	id: string
	headerBackgroundColor: string
	AvatarComponent: React.ReactNode
	isEdit: boolean
	setIsEdit: (value: boolean) => void
	nodeName: string
	onChangeName: (value: string) => void
	openPopup: boolean
	setOpenPopup: (value: boolean) => void
	onDropdownClick: (e: React.MouseEvent) => void
	type: string
	desc: string
	customNodeRenderConfig: any
	HeaderRight: React.ReactNode
	allowDebug: boolean
	isDebug: boolean
	onDebugChange: (value: boolean) => void
}

const NodeHeader = memo(
	({
		id,
		headerBackgroundColor,
		AvatarComponent,
		isEdit,
		setIsEdit,
		nodeName,
		onChangeName,
		openPopup,
		setOpenPopup,
		onDropdownClick,
		type,
		desc,
		customNodeRenderConfig,
		HeaderRight,
		allowDebug,
		isDebug,
		onDebugChange,
	}: NodeHeaderProps) => {
		return (
			<div
				className={clsx(styles.header, `${prefix}header`)}
				style={{ background: headerBackgroundColor }}
			>
				<div className={clsx(styles.left, `${prefix}left`)}>
					<Flex>
						{AvatarComponent}
						<TextEditable
							isEdit={isEdit}
							title={nodeName}
							onChange={onChangeName}
							setIsEdit={setIsEdit}
							className="nodrag"
						/>
						<Popover
							content={<FlowPopup nodeId={id} />}
							placement="right"
							showArrow={false}
							overlayClassName={clsx(styles.popup, `${prefix}popup`)}
							open={openPopup}
						>
							<Tooltip
								title={i18next.t("flow.changeNodeType", {
									ns: "magicFlow",
								})}
							>
								<IconChevronDown
									className={clsx(
										styles.hoverIcon,
										styles.modifyIcon,
										`${prefix}hover-icon`,
										`${prefix}modify-icon`,
									)}
									onClick={(e) => {
										onDropdownClick(e)
										setOpenPopup(!openPopup)
									}}
								/>
							</Tooltip>
						</Popover>
					</Flex>

					{!customNodeRenderConfig?.[type]?.hiddenDesc && (
						<div className={clsx(styles.desc, `${prefix}desc`)}>{desc}</div>
					)}
				</div>

				<div className={clsx(styles.right, `${prefix}right`)}>
					{HeaderRight}
					{allowDebug && (
						<Tooltip
							title={
								isDebug
									? i18next.t("flow.disableDebug", { ns: "magicFlow" })
									: i18next.t("flow.enableDebug", { ns: "magicFlow" })
							}
						>
							<IconBugFilled
								className={clsx(styles.icon, `${prefix}icon`, {
									[styles.checked]: isDebug,
									checked: isDebug,
								})}
								onClick={() => onDebugChange(!isDebug)}
								size={20}
							/>
						</Tooltip>
					)}
				</div>
			</div>
		)
	},
)

export default NodeHeader
