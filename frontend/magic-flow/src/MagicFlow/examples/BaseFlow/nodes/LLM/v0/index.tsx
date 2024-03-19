import { useNodeConfigActions } from "@/MagicFlow/context/FlowContext/useFlow"
import { useCurrentNode } from "@/MagicFlow/nodes/common/context/CurrentNode/useCurrentNode"
import DropdownCard from "@/common/BaseUI/DropdownCard"
import { useMemoizedFn } from "ahooks"
import { Form } from "antd"
import _ from "lodash"
import React from "react"
import MagicExpression from "../../../common/Expression"
import Output from "../../../common/Output"
import useCurrentNodeUpdate from "../../../common/hooks/useCurrentNodeUpdate"
import usePrevious from "../../../common/hooks/usePrevious"
import LLMParameters from "./components/LLMParameters"
import useLLM from "./hooks/useLLM"
import styles from "./index.module.less"

export default function LLMV0() {
	const [form] = Form.useForm()
	const { updateNodeConfig } = useNodeConfigActions()

	const { currentNode } = useCurrentNode()

	const { LLMOptions, LLMValue, onLLMValueChange, initialValues } = useLLM({ form })

	const { expressionDataSource } = usePrevious()

	const onValuesChange = useMemoizedFn((changeValues) => {
		if (!currentNode) return

		// 特殊处理llm字段
		if (changeValues.llm) {
			const { model, ...rest } = changeValues.llm
			_.set(currentNode, ["params", "model"], model)
			if (rest && Object.keys(rest).length)
				_.set(currentNode, ["params", "model_config"], rest)
		} else {
			Object.entries(changeValues).forEach(([changeKey, changeValue]) => {
				_.set(currentNode, ["params", changeKey], changeValue)
			})
		}

		updateNodeConfig({ ...currentNode })
	})

	console.log("getFieldsValue", form.getFieldsValue(), initialValues)

	useCurrentNodeUpdate({
		form,
	})

	return (
		<div className={styles.llm}>
			<Form
				form={form}
				layout="vertical"
				onValuesChange={onValuesChange}
				initialValues={initialValues}
			>
				<Form.Item name="llm" label="模型" className={styles.formItem}>
					<LLMParameters
						LLMValue={LLMValue}
						onChange={onLLMValueChange}
						options={LLMOptions}
					/>
					{/* <LLMSelect value={inputValue} onChange={onChange} options={LLMOptions} /> */}
				</Form.Item>
				<div className={styles.inputHeader}>输入</div>
				<div className={styles.inputBody}>
					<DropdownCard
						title="提示词"
						headerClassWrapper={styles.promptWrapper}
						height="auto"
					>
						<MagicExpression
							label="System"
							name="system_prompt"
							placeholder="大模型固定的引导词，通过调整内容引导大模型聊天方向，提示词内容会被固定在上下文的开头，支持使用“@”添加变量"
							dataSource={expressionDataSource}
							showExpand
						/>

						<MagicExpression
							label="User"
							name="user_prompt"
							placeholder="大模型固定的引导词，通过调整内容引导大模型聊天方向，提示词内容会被固定在上下文的开头，支持使用“@”添加变量"
							className={styles.LLMInput}
							dataSource={expressionDataSource}
						/>
					</DropdownCard>
				</div>
				{/* @ts-ignore  */}
				<Output value={currentNode?.output} />
			</Form>
		</div>
	)
}
