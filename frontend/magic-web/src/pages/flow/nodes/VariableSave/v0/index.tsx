import { Form } from "antd"
import { useForm } from "antd/lib/form/Form"
import { useMemoizedFn } from "ahooks"
import { useNodeConfigActions } from "@dtyq/magic-flow/dist/MagicFlow/context/FlowContext/useFlow"
import { useCurrentNode } from "@dtyq/magic-flow/dist/MagicFlow/nodes/common/context/CurrentNode/useCurrentNode"
import { set, cloneDeep } from "lodash-es"
import MagicJSONSchemaEditorWrap from "@dtyq/magic-flow/dist/common/BaseUI/MagicJsonSchemaEditorWrap"
import { ShowColumns } from "@dtyq/magic-flow/dist/MagicJsonSchemaEditor/constants"
import { FormItemType } from "@dtyq/magic-flow/dist/MagicExpressionWidget/types"
import { useMemo } from "react"
import { useTranslation } from "react-i18next"
import styles from "./index.module.less"
import usePrevious from "../../../common/hooks/usePrevious"
import useCurrentNodeUpdate from "../../../common/hooks/useCurrentNodeUpdate"
import { v0Template } from "./template"

export default function VariableSaveV0() {
	const { t } = useTranslation()
	const [form] = useForm()
	const { updateNodeConfig } = useNodeConfigActions()

	const { currentNode } = useCurrentNode()

	const { expressionDataSource } = usePrevious()

	const onValuesChange = useMemoizedFn((changeValues) => {
		if (!currentNode) return
		Object.entries(changeValues).forEach(([changeKey, changeValue]) => {
			if (changeKey === "variables") {
				set(currentNode, ["output"], changeValue)
			}
			set(currentNode, ["params", changeKey], changeValue)
		})
		updateNodeConfig({
			...currentNode,
		})
	})

	const initialValues = useMemo(() => {
		return currentNode?.params || v0Template.params
	}, [currentNode])

	useCurrentNodeUpdate({
		form,
		initialValues,
	})

	return (
		<div className={styles.variableWrapper}>
			<Form
				form={form}
				initialValues={initialValues}
				layout="vertical"
				onValuesChange={onValuesChange}
			>
				<Form.Item name={["variables", "form"]}>
					<MagicJSONSchemaEditorWrap
						allowExpression
						expressionSource={expressionDataSource}
						displayColumns={[
							ShowColumns.Key,
							ShowColumns.Label,
							ShowColumns.Type,
							ShowColumns.Value,
						]}
						customOptions={{
							root: [FormItemType.Object],
							normal: [FormItemType.Number, FormItemType.String],
						}}
						columnNames={{
							[ShowColumns.Key]: t("common.variableName", { ns: "flow" }),
							[ShowColumns.Type]: t("common.variableType", { ns: "flow" }),
							[ShowColumns.Value]: t("common.variableValue", { ns: "flow" }),
							[ShowColumns.Label]: t("common.showName", { ns: "flow" }),
							[ShowColumns.Encryption]: t("common.encryption", { ns: "flow" }),
							[ShowColumns.Description]: t("common.variableDesc", { ns: "flow" }),
							[ShowColumns.Required]: t("common.required", { ns: "flow" }),
						}}
					/>
				</Form.Item>
			</Form>
		</div>
	)
}
