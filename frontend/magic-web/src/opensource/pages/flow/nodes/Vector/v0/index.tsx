import { Form } from "antd"
import { useForm } from "antd/lib/form/Form"
import { useMemo } from "react"
import { useMemoizedFn } from "ahooks"
import { useNodeConfigActions } from "@dtyq/magic-flow/dist/MagicFlow/context/FlowContext/useFlow"
import { useCurrentNode } from "@dtyq/magic-flow/dist/MagicFlow/nodes/common/context/CurrentNode/useCurrentNode"
import { set, cloneDeep } from "lodash-es"
import MagicExpressionWrap from "@dtyq/magic-flow/dist/common/BaseUI/MagicExpressionWrap"
import { ExpressionMode } from "@dtyq/magic-flow/dist/MagicExpressionWidget/constant"
import MagicJsonSchemaEditor from "@dtyq/magic-flow/dist/MagicJsonSchemaEditor"
import { ShowColumns } from "@dtyq/magic-flow/dist/MagicJsonSchemaEditor/constants"
import { FormItemType } from "@dtyq/magic-flow/dist/MagicExpressionWidget/types"
import type { Widget } from "@/opensource/types/flow"
import type Schema from "@dtyq/magic-flow/dist/MagicJsonSchemaEditor/types/Schema"
import { useTranslation } from "react-i18next"
import { getExpressionPlaceholder } from "@/opensource/pages/flow/utils/helpers"
import usePrevious from "../../../common/hooks/usePrevious"
import styles from "./index.module.less"
import KnowledgeSelect from "../../VectorSearch/v0/components/KnowledgeSelect/KnowledgeSelect"
import useOldKnowledgeHandle from "../../VectorSearch/v0/components/KnowledgeSelect/hooks/useOldKnowledgeHandle"
import useCurrentNodeUpdate from "../../../common/hooks/useCurrentNodeUpdate"
import { v0Template } from "./template"

export default function VectorV0() {
	const { t } = useTranslation()
	const [form] = useForm()
	const { updateNodeConfig } = useNodeConfigActions()

	const { currentNode } = useCurrentNode()

	const { expressionDataSource } = usePrevious()

	const onValuesChange = useMemoizedFn((changeValues) => {
		if (!currentNode) return

		Object.entries(changeValues).forEach(([changeKey, changeValue]) => {
			if (changeKey === "metadata") {
				set(
					currentNode,
					["params", "metadata", "structure"],
					(changeValue as Widget<Schema>)?.structure,
				)
				return
			}
			set(currentNode, ["params", changeKey], changeValue)
		})

		updateNodeConfig({
			...currentNode,
		})
	})

	const { handleOldKnowledge } = useOldKnowledgeHandle()

	const initialValues = useMemo(() => {
		let resultValue = {
			...cloneDeep(v0Template.params),
			...currentNode?.params,
		}
		// @ts-ignore
		resultValue = handleOldKnowledge(resultValue)
		return resultValue
	}, [currentNode?.params, handleOldKnowledge])

	useCurrentNodeUpdate({
		form,
		initialValues,
	})

	return (
		<div className={styles.vectorWrapper}>
			<Form
				form={form}
				layout="vertical"
				initialValues={initialValues}
				onValuesChange={onValuesChange}
			>
				<KnowledgeSelect />
				<Form.Item
					name="content"
					label={t("vectorStorage.saveFragment", { ns: "flow" })}
					required
				>
					<MagicExpressionWrap
						placeholder={getExpressionPlaceholder(
							t("vectorStorage.saveFragmentPlaceholder", { ns: "flow" }),
						)}
						dataSource={expressionDataSource}
						onlyExpression
						mode={ExpressionMode.TextArea}
					/>
				</Form.Item>
				<Form.Item
					name={["metadata", "structure"]}
					label={t("common.metadata", { ns: "flow" })}
					className={styles.metadata}
					valuePropName="data"
					required
				>
					<MagicJsonSchemaEditor
						allowExpression
						expressionSource={expressionDataSource}
						displayColumns={[ShowColumns.Key, ShowColumns.Type, ShowColumns.Value]}
						customOptions={{
							root: [FormItemType.Object],
							normal: [FormItemType.Number, FormItemType.String],
						}}
					/>
				</Form.Item>
				<Form.Item
					name="business_id"
					label={t("common.businessId", { ns: "flow" })}
					extra={t("common.businessIdDesc", { ns: "flow" })}
					style={{ marginBottom: 0 }}
				>
					<MagicExpressionWrap
						placeholder={t("common.allowExpressionPlaceholder", { ns: "flow" })}
						dataSource={expressionDataSource}
						onlyExpression
						mode={ExpressionMode.TextArea}
					/>
				</Form.Item>
			</Form>
		</div>
	)
}
