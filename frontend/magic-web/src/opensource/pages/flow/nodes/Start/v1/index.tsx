import { Form } from "antd"
import {
	IconAppWindow,
	IconCalendarTime,
	IconMessageCircleHeart,
	IconPlus,
	IconRepeat,
	IconTrash,
	IconUserPlus,
} from "@tabler/icons-react"
import { useMemoizedFn } from "ahooks"
import { cx } from "antd-style"
import { nanoid } from "nanoid"
import { get, find, findIndex, set, cloneDeep } from "lodash-es"
import {
	useFlow,
	useFlowData,
	useNodeConfigActions,
} from "@dtyq/magic-flow/dist/MagicFlow/context/FlowContext/useFlow"
import { useCurrentNode } from "@dtyq/magic-flow/dist/MagicFlow/nodes/common/context/CurrentNode/useCurrentNode"
import TsInput from "@dtyq/magic-flow/dist/common/BaseUI/Input"
import { useTranslation } from "react-i18next"

import TsSelect from "@dtyq/magic-flow/dist/common/BaseUI/Select"
import { useMemo } from "react"
import { ShowColumns } from "@dtyq/magic-flow/dist/MagicJsonSchemaEditor/constants"
import MagicJsonSchemaEditor from "@dtyq/magic-flow/dist/MagicJsonSchemaEditor"
import { FormItemType } from "@dtyq/magic-flow/dist/MagicExpressionWidget/types"
import { FlowType } from "@/types/flow"
import DropdownCard from "@dtyq/magic-flow/dist/common/BaseUI/DropdownCard"
import JSONSchemaRenderer from "@dtyq/magic-flow/dist/common/BaseUI/JSONSchemaRenderer"
import CustomHandle from "@dtyq/magic-flow/dist/MagicFlow/nodes/common/Handle/Source"
import styles from "./index.module.less"
import type { WidgetValue } from "../../../common/Output"
import "./index.less"
import useCurrentNodeUpdate from "../../../common/hooks/useCurrentNodeUpdate"
import { TriggerType } from "./constants"
import { getDefaultTimeTriggerBranches } from "./components/TimeTrigger/helpers"
import Common from "./components/Common"
import TimeTrigger from "./components/TimeTrigger"
import { v1Template } from "./template"

const Splitor = "$$"

export default function StartV1() {
	const { t } = useTranslation()
	const [form] = Form.useForm()
	const { updateNodeConfig } = useNodeConfigActions()
	const { flow } = useFlowData()

	const { currentNode } = useCurrentNode()

	const isInLoopBody = useMemo(() => {
		return currentNode?.meta?.parent_id
	}, [currentNode?.meta?.parent_id])

	const templateBranches = useMemo(() => {
		return get(v1Template, ["template", "params", "branches"], [])
	}, [])

	const branches = useMemo(() => {
		return get(currentNode, ["params", "branches"], [])
	}, [currentNode])

	const getStructure = useMemoizedFn((branch) => {
		return branch?.output?.form
	})

	const newFriendsTemplate = useMemo(() => {
		let newFriendsBranch = find(branches, { trigger_type: TriggerType.NewFriends })
		if (!newFriendsBranch) {
			newFriendsBranch = find(templateBranches as any, {
				trigger_type: TriggerType.NewFriends,
			})
		}
		return getStructure(newFriendsBranch)
	}, [branches, getStructure, templateBranches])

	const chatTemplate = useMemo(() => {
		return getStructure(find(branches, { trigger_type: TriggerType.NewChat }))
	}, [branches, getStructure])

	const messageTemplate = useMemo(() => {
		return getStructure(find(branches, { trigger_type: TriggerType.Message }))
	}, [branches, getStructure])

	const loopStartTemplate = useMemo(() => {
		return getStructure(find(branches, { trigger_type: TriggerType.LoopStart }))
	}, [branches, getStructure])

	const argumentsBranch = useMemo(() => {
		return find(branches, { trigger_type: TriggerType.Arguments })
	}, [branches])

	const onChange = useMemoizedFn(
		// { '1.unit': "minutes" }
		(changeValues) => {
			if (!currentNode) return
			const triggerTypeToConfig = {} as Record<string, any>
			Object.keys(changeValues).forEach((changeValueKey) => {
				const innerValue = Reflect.get(changeValues, changeValueKey)
				const [triggerType, name] = changeValueKey.split(Splitor)
				if (!Reflect.has(triggerTypeToConfig, triggerType)) {
					triggerTypeToConfig[triggerType] = {} as Record<string, any>
				}
				set(triggerTypeToConfig, [triggerType, name], innerValue)
			})

			/**
			 * triggerTypeToConfig: {
			 *    2: {
			 *         "unit": "minutes",
			 *         "interval": 20
			 *       }
			 * }
			 */

			const node = currentNode

			// eslint-disable-next-line no-restricted-syntax, prefer-const
			for (let [triggerType, newConfig] of Object.entries(triggerTypeToConfig)) {
				// @ts-ignore
				triggerType = Number(triggerType)
				const branchIndex = findIndex(node?.params?.branches, {
					// @ts-ignore
					trigger_type: triggerType as number,
				})
				// eslint-disable-next-line no-continue
				if (branchIndex === -1) continue
				const oldBranch = node?.params?.branches?.[branchIndex]
				if (!oldBranch) return
				// @ts-ignore
				if (triggerType === TriggerType.Arguments) {
					const cloneOutput = cloneDeep(oldBranch?.output as WidgetValue["value"])
					const cloneCustomSystemOutput = cloneDeep(
						// @ts-ignore
						oldBranch?.custom_system_output as WidgetValue["value"],
					)
					if (newConfig?.output) {
						set(cloneOutput, ["form", "structure"], newConfig?.output)
						set(oldBranch, ["output"], cloneOutput)
					}
					if (newConfig?.custom_system_output) {
						// 处理不存在custom_system_output的情况
						if (!cloneCustomSystemOutput.form) {
							cloneCustomSystemOutput.form = {
								id: `components-${nanoid(8)}`,
								version: "1",
								type: "form",
								// @ts-ignore
								structure: null,
							}
						}
						set(
							cloneCustomSystemOutput,
							["form", "structure"],
							newConfig?.custom_system_output,
						)
						set(oldBranch, ["custom_system_output"], cloneCustomSystemOutput)
					}
					break
				}
				set(oldBranch, ["config"], { ...oldBranch.config, ...newConfig })
			}

			updateNodeConfig({
				...node,
			})
		},
	)

	const initialValues = useMemo(() => {
		if ((flow?.type as number) === FlowType.Main) {
			const newFriendsBranch = find(branches, { trigger_type: TriggerType.NewFriends })
			if (!newFriendsBranch) {
				const defaultFriendsBranch = find(templateBranches, {
					trigger_type: TriggerType.NewFriends,
				})
				// @ts-ignore
				currentNode?.params?.branches?.push?.({
					...defaultFriendsBranch,
				})
			}
			const values = currentNode?.params?.branches?.reduce((acc, cur) => {
				if (!cur?.config) return acc
				Object.entries(cur?.config || {}).forEach(([configKey, configValue]) => {
					// @ts-ignore
					Reflect.set(acc, `${cur.trigger_type}${Splitor}${configKey}`, configValue)
				})
				return acc
			}, {})
			return values
		}
		const branchIndex = findIndex(currentNode?.params?.branches, {
			// @ts-ignore
			trigger_type: TriggerType.Arguments,
		})
		if (branchIndex === -1) return undefined
		const argsBranch = currentNode?.params?.branches?.[branchIndex]
		return {
			[`${TriggerType.Arguments}${Splitor}output`]: argsBranch?.output?.form?.structure,
			[`${TriggerType.Arguments}${Splitor}custom_system_output`]:
				// @ts-ignore
				argsBranch?.custom_system_output?.form?.structure ?? null,
		}
	}, [branches, currentNode?.params?.branches, flow?.type, templateBranches])

	const newFriendsBranchId = useMemo(() => {
		return currentNode?.params?.branches?.find(
			// @ts-ignore
			(branch) => branch.trigger_type === TriggerType.NewFriends,
		)?.branch_id
	}, [currentNode?.params?.branches])

	const newChatBranchId = useMemo(() => {
		return currentNode?.params?.branches?.find(
			// @ts-ignore
			(branch) => branch.trigger_type === TriggerType.NewChat,
		)?.branch_id
	}, [currentNode?.params?.branches])

	const newMessageBranchId = useMemo(() => {
		// @ts-ignore
		return currentNode?.params?.branches?.find(
			// @ts-ignore
			(branch) => branch.trigger_type === TriggerType.Message,
		)?.branch_id
	}, [currentNode?.params?.branches])

	const argsBranchId = useMemo(() => {
		// @ts-ignore
		return currentNode?.params?.branches?.find(
			// @ts-ignore
			(branch) => branch.trigger_type === TriggerType.Arguments,
		)?.branch_id
	}, [currentNode?.params?.branches])

	const loopStartBranchId = useMemo(() => {
		// @ts-ignore
		return currentNode?.params?.branches?.find(
			// @ts-ignore
			(branch) => branch.trigger_type === TriggerType.LoopStart,
		)?.branch_id
	}, [currentNode?.params?.branches])

	const timeTriggerBranches = useMemo(() => {
		const resultBranches = currentNode?.params?.branches?.filter?.((branch) => {
			// @ts-ignore
			return branch?.trigger_type === TriggerType.TimeTrigger
		})
		return resultBranches
	}, [currentNode])

	/** 新增定时触发分支 */
	const onAddTimeTriggerBranch = useMemoizedFn(() => {
		if (!currentNode) return
		const newTimeTriggerBranch = getDefaultTimeTriggerBranches()
		// @ts-ignore
		currentNode?.params?.branches?.push(newTimeTriggerBranch)
		updateNodeConfig({ ...currentNode })
	})

	// console.log("timeTriggerBranches", timeTriggerBranches)

	const deleteTimeTriggerBranch = useMemoizedFn((branch) => {
		if (!currentNode) return
		const branchIndex = currentNode?.params?.branches?.findIndex(
			(b) => b.branch_id === branch.branch_id,
		)
		if (branchIndex === undefined || branchIndex === -1) return
		currentNode?.params?.branches?.splice(branchIndex, 1)
		updateNodeConfig({ ...currentNode })
	})

	useCurrentNodeUpdate({
		form,
		initialValues,
	})

	return (
		<div className={styles.inputParams}>
			<Form form={form} onValuesChange={onChange} initialValues={initialValues}>
				{!isInLoopBody && (
					<>
						{(flow?.type as number) === FlowType.Main && (
							<>
								<Common
									icon={
										<IconUserPlus
											color="#00C1D2"
											className={cx(styles.icon, styles.chatWindowsIcon)}
										/>
									}
									title={t("start.addFriends", { ns: "flow" })}
									// @ts-ignore
									template={newFriendsTemplate}
									branchId={newFriendsBranchId}
									className="start-list-item"
									defaultExpand={false}
								/>
								<Common
									icon={
										<IconAppWindow
											color="#315CEC"
											className={cx(styles.icon, styles.chatWindowsIcon)}
										/>
									}
									title={t("start.openWindows", { ns: "flow" })}
									// @ts-ignore
									template={chatTemplate}
									branchId={newChatBranchId}
									className="start-list-item"
									defaultExpand={false}
								>
									<div className={styles.chatWindowsParams}>
										<div className={styles.title}>
											{t("start.openWindowsDesc", { ns: "flow" })}
										</div>
										<div className={styles.inputWrap}>
											<Form.Item
												name={`${TriggerType.NewChat}${Splitor}interval`}
												style={{ flex: 1 }}
												normalize={(value) => Number(value)}
											>
												<TsInput
													placeholder={t("common.time", { ns: "flow" })}
													type="number"
													className="nodrag"
												/>
											</Form.Item>
											<Form.Item
												name={`${TriggerType.NewChat}${Splitor}unit`}
												style={{ width: "100px" }}
											>
												<TsSelect
													options={[
														{
															label: t("common.hours", {
																ns: "flow",
															}),
															value: "hours",
														},
														{
															label: t("common.minutes", {
																ns: "flow",
															}),
															value: "minutes",
														},
														{
															label: t("common.seconds", {
																ns: "flow",
															}),
															value: "seconds",
														},
													]}
													defaultValue="minutes"
													className={styles.select}
												/>
											</Form.Item>
										</div>
									</div>
								</Common>
								<Common
									icon={
										<IconMessageCircleHeart
											color="#32C436"
											className={cx(styles.icon, styles.messageIcon)}
										/>
									}
									title={t("start.newMessages", { ns: "flow" })}
									// @ts-ignore
									template={messageTemplate}
									branchId={newMessageBranchId}
									className="start-list-item"
								/>
							</>
						)}
						{(flow?.type as number) !== FlowType.Main && (
							<div className={styles.argsBranch}>
								<CustomHandle
									type="source"
									isConnectable
									nodeId={currentNode?.node_id || ""}
									isSelected
									id={argsBranchId}
								/>
								<DropdownCard title={t("common.systemInput", { ns: "flow" })}>
									<JSONSchemaRenderer
										// @ts-ignore
										form={argumentsBranch?.system_output?.form?.structure}
									/>
								</DropdownCard>
								{(flow?.type as number) === FlowType.Tools && (
									<DropdownCard
										title={t("common.customSystemInput", { ns: "flow" })}
										height="auto"
									>
										<Form.Item
											name={`${TriggerType.Arguments}${Splitor}custom_system_output`}
											className={styles.args}
											valuePropName="data"
										>
											<MagicJsonSchemaEditor
												allowExpression
												expressionSource={[]}
												displayColumns={[
													ShowColumns.Key,
													ShowColumns.Label,
													ShowColumns.Type,
													ShowColumns.Description,
													ShowColumns.Required,
												]}
												customOptions={{
													root: [FormItemType.Object],
													normal: [
														FormItemType.Number,
														FormItemType.String,
														FormItemType.Boolean,
														FormItemType.Array,
														FormItemType.Object,
													],
												}}
											/>
										</Form.Item>
									</DropdownCard>
								)}
								<DropdownCard
									title={
										(flow?.type as number) === FlowType.Tools
											? t("common.llmArgumentsInput", { ns: "flow" })
											: t("common.argumentsInput", { ns: "flow" })
									}
									height="auto"
								>
									<Form.Item
										name={`${TriggerType.Arguments}${Splitor}output`}
										className={styles.args}
										valuePropName="data"
									>
										<MagicJsonSchemaEditor
											allowExpression
											expressionSource={[]}
											displayColumns={[
												ShowColumns.Key,
												ShowColumns.Label,
												ShowColumns.Type,
												ShowColumns.Description,
												ShowColumns.Required,
											]}
											customOptions={{
												root: [FormItemType.Object],
												normal: [
													FormItemType.Number,
													FormItemType.String,
													FormItemType.Boolean,
													FormItemType.Array,
													FormItemType.Object,
												],
											}}
										/>
									</Form.Item>
								</DropdownCard>
							</div>
						)}

						{timeTriggerBranches?.map?.((branch) => {
							return (
								<Common
									icon={
										<IconCalendarTime
											color="#FF7D00"
											className={cx(styles.icon, styles.timeTriggerIcon)}
										/>
									}
									title={t("start.timeTrigger", { ns: "flow" })}
									key={branch.branch_id}
									branchId={branch.branch_id}
									// @ts-ignore
									template={getStructure(branch)}
									className="start-list-item"
									headerRight={
										<IconTrash
											className={styles.iconTrash}
											width={20}
											color="rgba(28, 29, 35, 0.8)"
											onClick={() => deleteTimeTriggerBranch(branch)}
										/>
									}
								>
									<div className={styles.timeTriggerParams}>
										<TimeTrigger branchId={branch.branch_id} />
									</div>
								</Common>
							)
						})}
						{(flow?.type as number) === FlowType.Main && (
							<div className={styles.addTimeTrigger} onClick={onAddTimeTriggerBranch}>
								<IconPlus stroke={2} size={16} />
								<span>{t("start.addTimeTrigger", { ns: "flow" })}</span>
							</div>
						)}
					</>
				)}

				{isInLoopBody && (
					<Common
						icon={
							<IconRepeat
								color="#A61CCB"
								className={cx(styles.icon, styles.timeTriggerIcon)}
							/>
						}
						title={t("loop.loopStart", { ns: "flow" })}
						branchId={loopStartBranchId}
						// @ts-ignore
						template={loopStartTemplate}
						className="start-list-item"
						showOutput={false}
						style={{ padding: 0, margin: "0 0 12px 12px" }}
					/>
				)}
			</Form>
		</div>
	)
}
