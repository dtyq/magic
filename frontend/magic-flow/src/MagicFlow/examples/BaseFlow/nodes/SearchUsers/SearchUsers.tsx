import { ExpressionMode } from "@/MagicExpressionWidget/constant"
import { useFlow } from "@/MagicFlow/context/FlowContext/useFlow"
import { useCurrentNode } from "@/MagicFlow/nodes/common/context/CurrentNode/useCurrentNode"
import DropdownCard from "@/common/BaseUI/DropdownCard"
import MagicExpressionWrap from "@/common/BaseUI/MagicExpressionWrap"
import MagicSelect from "@/common/BaseUI/Select"
import { Flex, Form } from "antd"
import { IconCircleMinus, IconPlus } from "@tabler/icons-react"
import { useMemoizedFn } from "ahooks"
import _ from "lodash"
import React, { useMemo } from "react"
import NodeOutputWrap from "../../common/NodeOutputWrap/NodeOutputWrap"
import usePrevious from "../../common/hooks/usePrevious"
import styles from "./SearchUsers.module.less"
import { filterTargetOptions } from "./constants"
import { getDefaultFilter, getFilterOption } from "./helpers"
import useFilters from "./hooks/useFilters"
import useRenderConfig from "./hooks/useRenderConfig"

export default function SearchUsers() {
	const [form] = Form.useForm()
	const { currentNode } = useCurrentNode()
	const { FilterTypeSelector } = useFilters()
	const { updateNodeConfig } = useFlow()

	const { expressionDataSource } = usePrevious()

	const initialValues = useMemo(() => {
		return {
			// ...templateMap[customNodeType.SearchUsers].params,
			...currentNode?.params,
		}
	}, [currentNode])

	const onValuesChange = useMemoizedFn(() => {
		if (!currentNode) return
		Object.entries(form.getFieldsValue()).forEach(([changeKey, changeValue]) => {
			_.set(currentNode, ["params", changeKey], changeValue)
		})
		updateNodeConfig(_.cloneDeep(currentNode))
	})

	const { getRenderConfig, getExtraConfig } = useRenderConfig()

	return (
		<NodeOutputWrap className={styles.searchUsers}>
			<Form form={form} initialValues={initialValues} onValuesChange={onValuesChange}>
				<DropdownCard title="检索条件" height="auto" suffixIcon={FilterTypeSelector}>
					<Form.Item>
						<Form.List name={["filters"]}>
							{(subFields, subOpt) => {
								const filters = form.getFieldValue(["filters"])
								return (
									<div className={styles.filters}>
										{subFields.map((subField, i) => {
											const filterItem = form.getFieldValue(["filters", i])
											const operatorOptions = getFilterOption(
												filterItem?.left,
											)
											const renderConfig = getRenderConfig(filterItem)
											const extraConfig = getExtraConfig(filterItem?.left)
											return (
												<Flex
													key={subField.key}
													className={styles.filterItem}
													gap={10}
												>
													<div className={styles.left}>
														<Form.Item
															noStyle
															name={[subField.name, "left"]}
														>
															<MagicSelect
																options={filterTargetOptions}
															/>
														</Form.Item>
													</div>
													<div className={styles.operator}>
														<Form.Item
															noStyle
															name={[subField.name, "operator"]}
														>
															<MagicSelect
																options={operatorOptions}
															/>
														</Form.Item>
													</div>
													<div className={styles.right}>
														<Form.Item
															noStyle
															name={[subField.name, "right"]}
															className={styles.right}
														>
															<MagicExpressionWrap
																placeholder="使用@添加变量"
																dataSource={expressionDataSource}
																mode={ExpressionMode.Common}
																// @ts-ignore
																renderConfig={renderConfig}
																{...extraConfig}
															/>
														</Form.Item>
													</div>
													<span
														className={styles.deleteIcon}
														onClick={() => {
															subOpt.remove(subField.name)
														}}
													>
														<IconCircleMinus
															stroke={1}
															size={20}
															color="#1C1D2399"
														/>
													</span>
												</Flex>
											)
										})}
										<span
											onClick={() =>
												subOpt.add(getDefaultFilter(), filters.length)
											}
											className={styles.addBtn}
										>
											<IconPlus width={20} color="#1C1D23CC" />
											<span>添加条件</span>
										</span>
									</div>
								)
							}}
						</Form.List>
					</Form.Item>
				</DropdownCard>
			</Form>
		</NodeOutputWrap>
	)
}
