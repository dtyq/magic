import type { ModalFuncProps, ModalProps } from "antd"
import { Modal } from "antd"
import { useMemo } from "react"
import { useStyles } from "./style"
import IconWarning from "../IconWarning"
import { colorScales } from "../ThemeProvider"
import { DangerLevel } from "../WarningModal"

export interface MagicModalProps extends ModalProps {
	/** 是否显示分割线 */
	showDivider?: boolean
}

const MagicModal = ({
	classNames,
	okText,
	cancelText,
	showDivider = true,
	closable = true,
	...props
}: MagicModalProps) => {
	const { styles, cx } = useStyles({ showDivider })
	/** 没有关闭按钮是另一种样式  */
	const classnames = useMemo(
		() => ({
			...classNames,
			header: cx(styles.header, !closable && styles.headerNoClose, classNames?.header),
			content: cx(styles.content, classNames?.content),
			footer: cx(styles.footer, !closable && styles.footerNoClose, classNames?.footer),
			body: cx(styles.body, classNames?.body),
		}),
		[
			classNames,
			cx,
			closable,
			styles.header,
			styles.headerNoClose,
			styles.content,
			styles.footer,
			styles.footerNoClose,
			styles.body,
		],
	)
	return <Modal classNames={classnames} destroyOnHidden closable={closable} {...props} />
}

export interface MagicModalFuncProps extends ModalFuncProps {
	dangerLevel?: DangerLevel
}

const defaultModalProps = (config: MagicModalFuncProps): ModalFuncProps => {
	return {
		icon:
			config.dangerLevel === DangerLevel.Danger ? (
				<IconWarning
					size={24}
					color={colorScales.orange[5]}
					style={{ marginRight: 10, flexShrink: 0 }}
				/>
			) : (
				<svg
					style={{ marginRight: 10 }}
					xmlns="http://www.w3.org/2000/svg"
					width="24"
					height="24"
					viewBox="0 0 24 24"
					fill="#315CEC"
				>
					<path
						fillRule="evenodd"
						clipRule="evenodd"
						d="M12 23C18.0751 23 23 18.0751 23 12C23 5.92487 18.0751 1 12 1C5.92487 1 1 5.92487 1 12C1 18.0751 5.92487 23 12 23ZM14 7C14 8.10457 13.1046 9 12 9C10.8954 9 10 8.10457 10 7C10 5.89543 10.8954 5 12 5C13.1046 5 14 5.89543 14 7ZM9 10.75C9 10.3358 9.33579 10 9.75 10H12.5C13.0523 10 13.5 10.4477 13.5 11V16.5H14.25C14.6642 16.5 15 16.8358 15 17.25C15 17.6642 14.6642 18 14.25 18H9.75C9.33579 18 9 17.6642 9 17.25C9 16.8358 9.33579 16.5 9.75 16.5H10.5V11.5H9.75C9.33579 11.5 9 11.1642 9 10.75Z"
						fill="#315CEC"
					/>
				</svg>
			),
		okButtonProps: {
			style: {
				borderRadius: 8,
				backgroundColor: "#315CEC",
				fontWeight: 400,
			},
		},
		cancelButtonProps: {
			type: "text",
			style: {
				borderRadius: 8,
				fontWeight: 400,
				backgroundColor: "rgba(46, 47, 56, 0.05)",
			},
		},
	}
}

MagicModal.confirm = (config: MagicModalFuncProps) =>
	Modal.confirm({
		...defaultModalProps({
			...config,
			dangerLevel: config?.dangerLevel || DangerLevel.Danger,
		}),
		...config,
	})

MagicModal.info = (config: MagicModalFuncProps) =>
	Modal.info({
		...defaultModalProps,
		...config,
	})

MagicModal.success = (config: MagicModalFuncProps) =>
	Modal.success({
		...defaultModalProps,
		...config,
	})

MagicModal.error = (config: MagicModalFuncProps) =>
	Modal.error({
		...defaultModalProps,
		...config,
	})

MagicModal.warning = (config: MagicModalFuncProps) =>
	Modal.warning({
		...defaultModalProps,
		...config,
	})
export default MagicModal
