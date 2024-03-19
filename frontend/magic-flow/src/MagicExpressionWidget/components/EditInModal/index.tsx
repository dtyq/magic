import CustomInputExpression from "@/MagicExpressionWidget/InputExpression"
import { ExpressionMode } from "@/MagicExpressionWidget/constant"
import { InputExpressionProps } from "@/MagicExpressionWidget/types"
import { Modal } from "antd"
import { useMemoizedFn, useResetState } from "ahooks"
import i18next from "i18next"
import _ from "lodash"
import React, { useEffect } from "react"
import { useTranslation } from "react-i18next"
import "./index.less"

export default function EditInModal({ value, onChange, ...props }: InputExpressionProps) {
	const { t } = useTranslation()
	const [open, setOpen, resetOpen] = useResetState(false)

	const [innerValue, setInnerValue, resetValue] = useResetState(_.cloneDeep(value))

	useEffect(() => {
		setInnerValue(_.cloneDeep(value))
	}, [value])

	const resetState = useMemoizedFn(() => {
		resetOpen()
		resetValue()
	})

	const onOk = useMemoizedFn(() => {
		onChange?.(innerValue!)
		resetState()
	})

	return (
		<>
			<Modal
				wrapClassName="expression_edit_modal"
				open={open}
				onOk={onOk}
				onCancel={resetState}
				title={i18next.t("expression.editExpression", { ns: "magicFlow" })}
				maskClosable={false}
			>
				<CustomInputExpression
					value={innerValue}
					onChange={(val) => {
						setInnerValue(val)
					}}
					{...props}
					showMultipleLine={true}
					allowOpenModal={false}
					mode={ExpressionMode.TextArea}
					onlyExpression
					disabled={false}
					minHeight="248px"
				/>
			</Modal>
			<div
				onClick={(e) => {
					e.stopPropagation()
					setOpen(true)
				}}
				className="editWrapper"
			></div>
		</>
	)
}
