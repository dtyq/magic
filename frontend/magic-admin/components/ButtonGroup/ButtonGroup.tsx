import { memo } from "react"
import { Flex } from "antd"
import { useAdminComponents } from "../AdminComponentsProvider"
import type { MagicButtonProps } from "../MagicButton"
import MagicButton from "../MagicButton"

export interface ButtonGroupProps {
	/** 类名 */
	className?: string
	/** 样式 */
	style?: React.CSSProperties
	/** 确定按钮文本 */
	okText?: string
	/** 取消按钮文本 */
	cancelText?: string
	/** 确定按钮是否加载中 */
	loading?: boolean
	/** 确定按钮 props */
	okProps?: MagicButtonProps
	/** 取消按钮 props */
	cancelProps?: MagicButtonProps
	/** 取消按钮 props */
	onCancel?: () => void
	/** 保存按钮点击事件 */
	onSave?: () => void
}

const ButtonGroup = memo(
	({
		okText,
		cancelText,
		className,
		style,
		loading,
		okProps,
		cancelProps,
		onCancel,
		onSave,
	}: ButtonGroupProps) => {
		const { getLocale } = useAdminComponents()
		const locale = getLocale("ButtonGroup")

		return (
			<Flex gap={10} justify="end" align="center" className={className} style={style}>
				<MagicButton
					type="default"
					{...cancelProps}
					onClick={onCancel || cancelProps?.onClick}
				>
					{cancelText ?? locale.cancel}
				</MagicButton>
				<MagicButton
					type="primary"
					loading={loading}
					{...okProps}
					onClick={onSave || okProps?.onClick}
				>
					{okText ?? locale.save}
				</MagicButton>
			</Flex>
		)
	},
)

export default ButtonGroup
