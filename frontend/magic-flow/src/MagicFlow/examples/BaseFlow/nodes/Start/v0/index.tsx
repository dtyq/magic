import {
	useFlowData,
	useNodeConfigActions,
} from "@/MagicFlow/context/FlowContext/useFlow"
import { useCurrentNode } from "@/MagicFlow/nodes/common/context/CurrentNode/useCurrentNode"
import TsInput from "@/common/BaseUI/Input"
import TsSelect from "@/common/BaseUI/Select"
import { Form } from "antd"
import { IconAppWindow, IconMessageCircleHeart, IconRepeat } from "@tabler/icons-react"
import { useMemoizedFn } from "ahooks"
import clsx from "clsx"
import _ from "lodash"
import React, { useMemo } from "react"
import { WidgetValue } from "../../../common/Output"
import Common from "./components/Common"
import { TriggerType } from "./constants"
import styles from "./index.module.less"

const Splitor = "$$"

export default function StartV0() {
	const [form] = Form.useForm()
	const { flow } = useFlowData()
	const { updateNodeConfig } = useNodeConfigActions()

	const { currentNode } = useCurrentNode()

	const isInLoopBody = useMemo(() => {
		return currentNode?.meta?.parent_id
	}, [currentNode?.meta?.parent_id])

	const branches = useMemo(() => {
		return _.get(currentNode, ["params", "branches"], [])
	}, [currentNode])

	const chatTemplate = useMemo(() => {
		return _.find(branches, { trigger_type: TriggerType.NewChat })
	}, [branches])

	const messageTemplate = useMemo(() => {
		return _.find(branches, { trigger_type: TriggerType.Message })
	}, [branches])

	const loopStartTemplate = useMemo(() => {
		return _.find(branches, { trigger_type: TriggerType.LoopStart })
	}, [branches])

	const onChange = useMemoizedFn(
		// { '1.unit': "minutes" }
		(changeValues) => {
			const triggerTypeToConfig = {} as Record<string, any>
			Object.keys(changeValues).forEach((changeValueKey) => {
				const innerValue = Reflect.get(changeValues, changeValueKey)
				const [triggerType, name] = changeValueKey.split(Splitor)
				if (!Reflect.has(triggerTypeToConfig, triggerType)) {
					triggerTypeToConfig[triggerType] = {} as Record<string, any>
				}
				_.set(triggerTypeToConfig, [triggerType, name], innerValue)
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
				const branchIndex = _.findIndex(node?.params?.branches, {
					// @ts-ignore
					trigger_type: triggerType as number,
				})
				// eslint-disable-next-line no-continue
				if (branchIndex === -1) continue
				const oldBranch = node?.params?.branches?.[branchIndex]
				if (!oldBranch) return
				// @ts-ignore
				if (triggerType === TriggerType.Arguments) {
					const cloneOutput = _.cloneDeep(oldBranch?.output as WidgetValue["value"])
					_.set(cloneOutput, ["form", "structure"], newConfig?.output)
					_.set(oldBranch, ["output"], cloneOutput)
					_.set(oldBranch, ["input"], cloneOutput)
					break
				}
				_.set(oldBranch, ["config"], { ...oldBranch.config, ...newConfig })
			}

			updateNodeConfig({
				...node,
			})
		},
	)

	const initialValues = useMemo(() => {
		const values = currentNode?.params?.branches?.reduce((acc, cur) => {
			if (!cur?.config) return acc
			Object.entries(cur?.config || {}).forEach(([configKey, configValue]) => {
				// @ts-ignore
				Reflect.set(acc, `${cur.trigger_type}${Splitor}${configKey}`, configValue)
			})
			return acc
		}, {})
		return values
	}, [currentNode?.params?.branches, flow?.type])

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

	return (
		<div className={styles.inputParams}>
			<Form form={form} onValuesChange={onChange} initialValues={initialValues}>
				{!isInLoopBody && (
					<>
						<Common
							icon={
								<IconAppWindow
									color="#315CEC"
									className={clsx(styles.icon, styles.chatWindowsIcon)}
								/>
							}
							title="聊天窗口打开时"
							// @ts-ignore
							template={chatTemplate}
							branchId={newChatBranchId}
							className="start-list-item"
						>
							<div className={styles.chatWindowsParams}>
								<div className={styles.title}>距离上一次打开时间间隔多久才生效</div>
								<div className={styles.inputWrap}>
									<Form.Item
										name={`${TriggerType.NewChat}${Splitor}interval`}
										style={{ flex: 1 }}
										normalize={(value) => Number(value)}
									>
										<TsInput
											placeholder="时间"
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
												{ label: "小时", value: "hours" },
												{ label: "分钟", value: "minutes" },
												{ label: "秒", value: "seconds" },
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
									className={clsx(styles.icon, styles.messageIcon)}
								/>
							}
							title="接收新消息时"
							// @ts-ignore
							template={messageTemplate}
							branchId={newMessageBranchId}
							className="start-list-item"
						/>
					</>
				)}

				{isInLoopBody && (
					<Common
						icon={
							<IconRepeat
								color="#A61CCB"
								className={clsx(styles.icon, styles.timeTriggerIcon)}
							/>
						}
						title="循环起始"
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
