import { ExpressionMode } from "@/MagicExpressionWidget/constant"
import { InputExpressionProps } from "@/MagicExpressionWidget/types"
import MagicExpressionWrap, { WidgetExpressionValue } from "@/common/BaseUI/MagicExpressionWrap"
import { Form } from "antd"
import clsx from "clsx"
import React from "react"
import styles from "./index.module.less"

// @ts-ignore
interface LLMInput extends Partial<InputExpressionProps> {
	label: string
	name: string
	value?: WidgetExpressionValue
	onChange?: (value: WidgetExpressionValue) => void
	placeholder?: string
	className?: string
}

export default function MagicExpression({
	label,
	name,
	value,
	placeholder,
	className,
	onChange,
	...props
}: LLMInput) {
	return (
		<div className={clsx(styles.LLMInput, className)}>
			<div className={styles.header}>
				<div className={styles.left}>
					<span className={styles.title}>{label}</span>
				</div>
				<div className={styles.right}>
					<span className={styles.count}>0</span>
				</div>
			</div>
			<div className={styles.body}>
				<Form.Item name={name}>
					<MagicExpressionWrap
						onlyExpression
						mode={ExpressionMode.TextArea}
						placeholder={placeholder}
						minHeight="138px"
						{...props}
					/>
				</Form.Item>
			</div>
		</div>
	)
}
