import { IconExpand } from "@douyinfe/semi-icons"
import { Modal } from "antd"
import { useMemoizedFn } from "ahooks"
import i18next from "i18next"
import _ from "lodash"
import React, { useEffect, useState } from "react"
import CustomInputExpression from "../../InputExpression"
import { ExpressionMode } from "../../constant"
import { InputExpressionProps, InputExpressionValue } from "../../types"
import "./index.less"

interface ExpandModalProps {
	value: InputExpressionValue | null
	onChange: (value: InputExpressionValue) => void
	componentProps: InputExpressionProps
}

const ExpandModal: React.FC<ExpandModalProps> = ({ value, onChange, componentProps }) => {
	const [expandViewOpen, setExpandViewOpen] = useState(false)
	const [expandViewValue, setExpandViewValue] = useState<InputExpressionValue | null>(null)

	useEffect(() => {
		if (expandViewOpen) {
			setExpandViewValue(_.cloneDeep(value))
		}
	}, [expandViewOpen, value])

	const handleExpandViewOk = useMemoizedFn(() => {
		if (expandViewValue) {
			onChange(expandViewValue)
		}
		setExpandViewOpen(false)
	})

	const handleExpandViewCancel = useMemoizedFn(() => {
		setExpandViewOpen(false)
	})

	return (
		<>
			<div className="expand-button" onClick={() => setExpandViewOpen(true)}>
				<IconExpand />
			</div>

			<Modal
				wrapClassName="expression_expand_view_modal"
				open={expandViewOpen}
				onOk={handleExpandViewOk}
				onCancel={handleExpandViewCancel}
				title={i18next.t("expression.editContent", {
					ns: "magicFlow",
					defaultValue: "编辑内容",
				})}
				width="80%"
				style={{ top: 20 }}
				maskClosable={false}
			>
				<CustomInputExpression
					{...componentProps}
					value={expandViewValue || undefined}
					onChange={(val) => {
						setExpandViewValue(val)
					}}
					showMultipleLine={true}
					allowOpenModal={false}
					mode={ExpressionMode.TextArea}
					disabled={false}
					minHeight="70vh"
					maxHeight="72vh"
					showExpand={false}
				/>
			</Modal>
		</>
	)
}

export default ExpandModal
