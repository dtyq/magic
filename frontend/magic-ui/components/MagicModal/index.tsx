import type { ModalFuncProps, ModalProps } from "antd"
import { Modal as AntdModal } from "antd"
import { cx } from "antd-style"
import { useMemo } from "react"
import { useStyles } from "./style"

export type MagicModalProps = ModalProps

function MagicModal({ classNames: classNamesInProp, ...props }: MagicModalProps) {
	const { styles } = useStyles()

	const classNames = useMemo(
		() => ({
			...classNamesInProp,
			header: cx(styles.header, classNamesInProp?.header),
			content: cx(styles.content, classNamesInProp?.content),
			footer: cx(styles.footer, classNamesInProp?.footer),
			body: cx(styles.body, classNamesInProp?.body),
		}),
		[classNamesInProp, styles.body, styles.content, styles.footer, styles.header],
	)

	return <AntdModal classNames={classNames} {...props} />
}

const defaultModalProps: ModalFuncProps = {
	icon: (
		<svg
			style={{ marginRight: 10 }}
			xmlns="http://www.w3.org/2000/svg"
			width="24"
			height="24"
			viewBox="0 0 24 24"
			fill="none"
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
		},
	},
	cancelButtonProps: {
		style: {
			borderRadius: 8,
		},
	},
}

MagicModal.confirm = (config: ModalFuncProps) =>
	AntdModal.confirm({
		...defaultModalProps,
		...config,
	})

MagicModal.info = (config: ModalFuncProps) =>
	AntdModal.info({
		...defaultModalProps,
		...config,
	})

MagicModal.success = (config: ModalFuncProps) =>
	AntdModal.success({
		...config,
	})

MagicModal.error = (config: ModalFuncProps) =>
	AntdModal.error({
		...config,
	})

MagicModal.warning = (config: ModalFuncProps) =>
	AntdModal.warning({
		...config,
	})

export default MagicModal
