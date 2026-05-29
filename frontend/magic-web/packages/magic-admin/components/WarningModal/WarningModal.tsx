import { Flex } from "antd"
import { useMemoizedFn } from "ahooks"
import { IconX } from "@tabler/icons-react"
import { useEffect, useMemo, useState } from "react"
import { colorScales, colorUsages } from "../ThemeProvider/palettes"
import type { MagicModalProps } from "../MagicModal"
import MagicModal from "../MagicModal"
import IconWarning from "../IconWarning"
import MagicButton from "../MagicButton"
import { useStyles } from "./style"
import { useAdminComponents } from "../AdminComponentsProvider"

// 危险等级
export enum DangerLevel {
	/* 普通 */
	Normal = "normal",
	/* 危险 */
	Danger = "danger",
	/* 警告 */
	Warning = "warning",
}

export interface WarningModalProps extends Omit<MagicModalProps, "onOk"> {
	// 标题
	title?: string
	// 提示内容
	content: string | React.ReactNode
	// 描述
	description?: string
	// 危险等级
	dangerLevel?: DangerLevel
	// 是否显示删除文本
	showDeleteText?: boolean
	// 确认文本
	okText?: string
	// 确认按钮
	onOk?: () => void
	// 关闭按钮
	onClose?: () => void
}

function WarningModal({
	title,
	open: openProps = false,
	content,
	description,
	dangerLevel = DangerLevel.Danger,
	showDeleteText = true,
	onOk,
	onClose,
	onCancel,
	okText,
	cancelText,
	okButtonProps,
	cancelButtonProps,
	...props
}: WarningModalProps) {
	const { styles } = useStyles()

	const { getLocale } = useAdminComponents()
	const locale = getLocale("WarningModal")
	const [open, setOpen] = useState(openProps)

	useEffect(() => {
		setOpen(openProps)
	}, [openProps])

	const onInnerCancel = useMemoizedFn((e) => {
		setOpen(false)
		onCancel?.(e)
		onClose?.()
	})

	const onInnerOk = useMemoizedFn(() => {
		onOk?.()
		setOpen(false)
		onClose?.()
	})

	const footer = useMemoizedFn(() => (
		<Flex justify="end" gap={12}>
			<MagicButton
				onClick={onInnerCancel}
				type="text"
				className={styles.button}
				{...cancelButtonProps}
			>
				{cancelText || locale.cancel}
			</MagicButton>
			<MagicButton
				type="primary"
				onClick={onInnerOk}
				className={styles.dangerButton}
				danger
				{...okButtonProps}
			>
				{okText || locale.confirm}
			</MagicButton>
		</Flex>
	))

	const iconColor = useMemo(() => {
		switch (dangerLevel) {
			case DangerLevel.Danger:
				return colorUsages.danger.default
			case DangerLevel.Warning:
				return colorScales.orange[5]
			default:
				return colorUsages.primary.default
		}
	}, [dangerLevel])

	return (
		<MagicModal
			className={styles.modal}
			centered
			maskClosable={false}
			open={open}
			onOk={onInnerOk}
			onCancel={onInnerCancel}
			width={400}
			footer={footer}
			closeIcon={null}
			closable={false}
			destroyOnHidden
			{...props}
		>
			<Flex gap={12}>
				<IconWarning size={24} color={iconColor} className={styles.icon} />
				<Flex vertical gap={8} style={{ width: "100%" }}>
					<Flex justify="space-between" align="flex-start">
						<div className={styles.title}>{title || locale.deleteConfirm}</div>
						<MagicButton
							type="text"
							onClick={onInnerCancel}
							icon={<IconX size={16} />}
							className={styles.closeButton}
						/>
					</Flex>
					{showDeleteText ? (
						<>
							<div className={styles.descContent}>
								{locale.confirmDelete}「{content}」
							</div>
							{description && <div className={styles.desc}>{description}</div>}
						</>
					) : (
						<div className={styles.descContent}>{content}</div>
					)}
				</Flex>
			</Flex>
		</MagicModal>
	)
}

export default WarningModal
