import { Form, InputNumber } from "antd"
import { useForm } from "antd/lib/form/Form"
import { useMemo } from "react"
import { useMemoizedFn } from "ahooks"
import { useFlow } from "@dtyq/magic-flow/dist/MagicFlow/context/FlowContext/useFlow"
import { useCurrentNode } from "@dtyq/magic-flow/dist/MagicFlow/nodes/common/context/CurrentNode/useCurrentNode"
import { set, cloneDeep } from "lodash-es"
import MagicExpressionWrap from "@dtyq/magic-flow/dist/common/BaseUI/MagicExpressionWrap"
import { ExpressionMode } from "@dtyq/magic-flow/dist/MagicExpressionWidget/constant"
import MagicSlider from "@dtyq/magic-flow/dist/common/BaseUI/Slider"
import MagicJsonSchemaEditor from "@dtyq/magic-flow/dist/MagicJsonSchemaEditor"
import { ShowColumns } from "@dtyq/magic-flow/dist/MagicJsonSchemaEditor/constants"
import { FormItemType } from "@dtyq/magic-flow/dist/MagicExpressionWidget/types"
import type { Widget } from "@/types/flow"
import type Schema from "@dtyq/magic-flow/dist/MagicJsonSchemaEditor/types/Schema"
import { useTranslation } from "react-i18next"
import { getExpressionPlaceholder } from "@/pages/flow/utils/helpers"
import styles from "./index.module.less"
import usePrevious from "../../../common/hooks/usePrevious"
import Output from "../../../common/Output"
import KnowledgeSelect from "./components/KnowledgeSelect/KnowledgeSelect"
import useOldKnowledgeHandle from "./components/KnowledgeSelect/hooks/useOldKnowledgeHandle"
import useCurrentNodeUpdate from "../../../common/hooks/useCurrentNodeUpdate"
import { v0Template } from "./template"

export default function VectorSearchV0() {
	const { t } = useTranslation()
	const [form] = useForm()
	const { nodeConfig, updateNodeConfig, notifyNodeChange } = useFlow()

	const { currentNode } = useCurrentNode()

	const { expressionDataSource } = usePrevious()

	const onValuesChange = useMemoizedFn((changeValues) => {
		if (!currentNode || !nodeConfig || !nodeConfig[currentNode?.node_id]) return
		const currentNodeConfig = nodeConfig[currentNode?.node_id]

		Object.entries(changeValues).forEach(([changeKey, changeValue]) => {
			if (changeKey === "metadata_filter") {
				set(
					currentNodeConfig,
					["params", "metadata_filter", "structure"],
					(changeValue as Widget<Schema>)?.structure,
				)
				notifyNodeChange?.()
				return
			}
			set(currentNodeConfig, ["params", changeKey], changeValue)
		})

		updateNodeConfig({
			...currentNodeConfig,
		})
	})

	const { handleOldKnowledge } = useOldKnowledgeHandle()

	const initialValues = useMemo(() => {
		let resultValue = currentNode?.params || cloneDeep(v0Template.params)
		resultValue = handleOldKnowledge(resultValue, "knowledge_codes", "vector_database_ids")
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
				<KnowledgeSelect name="vector_database_ids" multiple />
				<Form.Item name="query" label={t("common.searchKeywords", { ns: "flow" })}>
					<MagicExpressionWrap
						placeholder={getExpressionPlaceholder(
							t("common.searchKeywordsPlaceholder", { ns: "flow" }),
						)}
						dataSource={expressionDataSource}
						onlyExpression
						mode={ExpressionMode.TextArea}
					/>
				</Form.Item>
				<Form.Item
					name="limit"
					label={t("common.maxReturnCount", { ns: "flow" })}
					extra={t("common.maxReturnCountDesc", { ns: "flow" })}
				>
					<InputNumber />
				</Form.Item>
				<Form.Item
					name="score"
					label={t("common.minMatchRatio", { ns: "flow" })}
					extra={t("common.minMatchRatioDesc", { ns: "flow" })}
				>
					<MagicSlider min={0} max={1} step={0.1} />
				</Form.Item>
				<Form.Item
					name={["metadata_filter", "structure"]}
					label={t("common.metadataMatch", { ns: "flow" })}
					className={styles.metadata}
					valuePropName="data"
					style={{ marginBottom: 0 }}
				>
					<MagicJsonSchemaEditor
						allowExpression
						expressionSource={expressionDataSource}
						displayColumns={[ShowColumns.Key, ShowColumns.Type, ShowColumns.Value]}
						customOptions={{
							root: [FormItemType.Object],
							normal: [FormItemType.Number, FormItemType.String, FormItemType.Array],
						}}
					/>
				</Form.Item>

				{/* @ts-ignore  */}
				<Output value={currentNode?.output} wrapperClassName={styles.output} />
			</Form>
		</div>
	)
}
