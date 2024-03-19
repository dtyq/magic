import { Form, Tooltip } from "antd"
import { useForm } from "antd/lib/form/Form"
import { useMemoizedFn } from "ahooks"
import { useNodeConfigActions } from "@dtyq/magic-flow/dist/MagicFlow/context/FlowContext/useFlow"
import { useCurrentNode } from "@dtyq/magic-flow/dist/MagicFlow/nodes/common/context/CurrentNode/useCurrentNode"
import { set } from "lodash-es"
import MagicJsonSchemaEditor from "@dtyq/magic-flow/dist/MagicJsonSchemaEditor"
import { ShowColumns } from "@dtyq/magic-flow/dist/MagicJsonSchemaEditor/constants"
import DropdownCard from "@dtyq/magic-flow/dist/common/BaseUI/DropdownCard"
import { DisabledField } from "@dtyq/magic-flow/dist/MagicJsonSchemaEditor/types/Schema"
import { IconInfoCircle, IconPlus, IconTrash } from "@tabler/icons-react"
import MagicExpressionWrap from "@dtyq/magic-flow/dist/common/BaseUI/MagicExpressionWrap"
import { ExpressionMode } from "@dtyq/magic-flow/dist/MagicExpressionWidget/constant"
import CustomHandle from "@dtyq/magic-flow/dist/MagicFlow/nodes/common/Handle/Source"
import { useTranslation } from "react-i18next"
import { getExpressionPlaceholder } from "@/opensource/pages/flow/utils/helpers"
import styles from "./index.module.less"
import usePrevious from "../../../common/hooks/usePrevious"
import { getDefaultIntention } from "./helpers"
import { IntentionBranchType } from "./constants"
import type { WidgetValue } from "../../../common/Output"
import LLMParameters from "./components/LLMParameters"
import useLLM from "./hooks/useLLM"
import useCurrentNodeUpdate from "../../../common/hooks/useCurrentNodeUpdate"

export default function IntentionRecognitionV0() {
	const { t } = useTranslation()
	const [form] = useForm()
	const { updateNodeConfig } = useNodeConfigActions()

	const { currentNode } = useCurrentNode()

	const { expressionDataSource } = usePrevious()

	const { LLMOptions, LLMValue, onLLMValueChange, initialValues } = useLLM({ form })

	const onValuesChange = useMemoizedFn((changeValues, allValues) => {
		if (!currentNode) return

		Object.entries(changeValues).forEach(([changeKey, changeValue]) => {
			// 特殊处理llm字段
			if (changeKey === "llm") {
				const { model, ...rest } = changeValue as any
				set(currentNode, ["params", "model"], model)
				if (rest && Object.keys(rest).length)
					set(currentNode, ["params", "model_config"], rest)
				return
			}
			if (changeKey === "input") {
				set(
					currentNode,
					["input", "form", "structure"],
					(changeValue as WidgetValue["value"])?.form?.structure,
				)
				return
			}
			if (changeKey === "branches") {
				// 合并更新后的 branches
				set(currentNode, ["params", "branches"], allValues?.branches)
				return
			}
			set(currentNode, ["params", changeKey], changeValue)
		})

		updateNodeConfig({
			...currentNode,
		})
	})

	// console.log("initialValues", initialValues, form.getFieldsValue())
	const formValues = form.getFieldsValue()

	useCurrentNodeUpdate({
		form,
		initialValues,
	})

	return (
		<div className={styles.intention}>
			<Form
				form={form}
				layout="vertical"
				initialValues={initialValues}
				onValuesChange={onValuesChange}
			>
				<DropdownCard
					title={t("common.input", { ns: "flow" })}
					height="auto"
					style={{ padding: "12px 12px 0 12px" }}
				>
					<Form.Item
						name={["input", "form", "structure"]}
						className={styles.input}
						valuePropName="data"
					>
						<MagicJsonSchemaEditor
							allowExpression
							expressionSource={expressionDataSource}
							displayColumns={[ShowColumns.Label, ShowColumns.Value]}
							showOperation={false}
							showAdd={false}
							disableFields={[DisabledField.Title]}
						/>
					</Form.Item>
				</DropdownCard>

				<Form.Item
					name="llm"
					label={t("common.model", { ns: "flow" })}
					className={styles.model}
				>
					<LLMParameters
						LLMValue={LLMValue}
						onChange={onLLMValueChange}
						options={LLMOptions ?? []}
						formValues={formValues}
					/>
				</Form.Item>
				<DropdownCard
					title={t("intentionRecognize.intention", { ns: "flow" })}
					height="auto"
					className={styles.branchesDropdown}
				>
					<Form.Item>
						<Form.List name={["branches"]}>
							{(subFields, subOpt) => {
								const branches = form.getFieldValue(["branches"])
								return (
									<div
										style={{
											display: "flex",
											flexDirection: "column",
										}}
										className={styles.branchList}
									>
										{subFields.map((subField, i) => {
											const branch = form.getFieldValue(["branches", i])

											const isIf =
												IntentionBranchType.If === branch.branch_type

											return (
												<>
													{isIf && (
														<div
															key={subField.key}
															className={styles.branchItem}
														>
															<div className={styles.intentionTopRow}>
																<span className={styles.title}>
																	{t(
																		"intentionRecognize.intention",
																		{ ns: "flow" },
																	)}{" "}
																	{i + 1}
																</span>
																<IconTrash
																	className={styles.iconX}
																	onClick={() => {
																		subOpt.remove(subField.name)
																	}}
																	width={20}
																	color="#1C1D2399"
																/>
															</div>
															<div className="intentionValue">
																<div>
																	<span className="label">
																		{t(
																			"intentionRecognize.intentionName",
																			{ ns: "flow" },
																		)}
																	</span>
																	<Form.Item
																		noStyle
																		name={[
																			subField.name,
																			"title",
																		]}
																		label={t(
																			"intentionRecognize.intentionName",
																			{ ns: "flow" },
																		)}
																		required
																	>
																		<MagicExpressionWrap
																			placeholder={t(
																				"intentionRecognize.intentionNamePlaceholder",
																				{ ns: "flow" },
																			)}
																			onlyExpression
																			dataSource={
																				expressionDataSource
																			}
																			mode={
																				ExpressionMode.TextArea
																			}
																			minHeight="20px"
																		/>
																	</Form.Item>
																</div>
																<div>
																	<span className="label">
																		{t(
																			"intentionRecognize.intentionDesc",
																			{ ns: "flow" },
																		)}
																	</span>
																	<Form.Item
																		noStyle
																		name={[
																			subField.name,
																			"desc",
																		]}
																		label={t(
																			"intentionRecognize.intentionDesc",
																			{ ns: "flow" },
																		)}
																		required
																	>
																		<MagicExpressionWrap
																			placeholder={getExpressionPlaceholder(
																				t(
																					"intentionRecognize.intentionDescPlaceholder",
																					{ ns: "flow" },
																				),
																			)}
																			dataSource={
																				expressionDataSource
																			}
																			onlyExpression
																			mode={
																				ExpressionMode.TextArea
																			}
																			minHeight="20px"
																			// @ts-ignore
																			allowOpenModal
																			showMultipleLine={false}
																			disabled
																		/>
																	</Form.Item>
																</div>
															</div>

															<CustomHandle
																type="source"
																isConnectable
																nodeId={currentNode?.node_id || ""}
																isSelected
																id={`${branch?.branch_id}`}
															/>
														</div>
													)}
													{!isIf && (
														<>
															<div
																onClick={() =>
																	subOpt.add(
																		getDefaultIntention(),
																		branches.length - 1,
																	)
																}
																className={styles.addBtn}
															>
																<IconPlus
																	width={20}
																	color="#1C1D23CC"
																/>
																<span>
																	{t(
																		"intentionRecognize.addIntention",
																		{ ns: "flow" },
																	)}
																</span>
															</div>
															<div className={styles.otherIntention}>
																<span>
																	{t(
																		"intentionRecognize.otherIntention",
																		{ ns: "flow" },
																	)}
																</span>
																<Tooltip
																	title={t(
																		"intentionRecognize.otherIntentionDesc",
																		{ ns: "flow" },
																	)}
																>
																	<IconInfoCircle
																		width={16}
																		color="#1C1D2399"
																	/>
																</Tooltip>

																<CustomHandle
																	type="source"
																	isConnectable
																	nodeId={
																		currentNode?.node_id || ""
																	}
																	isSelected
																	id={`${branch?.branch_id}`}
																/>
															</div>
														</>
													)}
												</>
											)
										})}
									</div>
								)
							}}
						</Form.List>
					</Form.Item>
				</DropdownCard>
			</Form>
		</div>
	)
}
