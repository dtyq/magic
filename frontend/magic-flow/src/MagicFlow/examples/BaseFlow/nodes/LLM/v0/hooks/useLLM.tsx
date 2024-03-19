import { customNodeType, templateMap } from "@/MagicFlow/examples/BaseFlow/constants"
import { useCurrentNode } from "@/MagicFlow/nodes/common/context/CurrentNode/useCurrentNode"
import { FormInstance } from "antd"
import { useMemoizedFn, useMount } from "ahooks"
import _ from "lodash"
import { useMemo, useState } from "react"
import { LLMParametersValue } from "../components/LLMParameters"
import { LLMLabelTagType } from "../components/LLMSelect/LLMLabel"

type UseLLM = {
	form: FormInstance<any>
}

export default function useLLM({ form }: UseLLM) {
	const { currentNode } = useCurrentNode()
	const [LLMValue, setLLMValue] = useState({
		model: "",
		temperature: {
			open: true,
			value: 0.7,
		},
		top_p: {
			open: false,
			value: 1,
		},
		exist_penalty: {
			open: false,
			value: 0,
		},
		frequency_penalty: {
			open: false,
			value: 0,
		},
		max_tags: {
			open: false,
			value: 512,
		},
		ask_type: {
			open: false,
		},
		stop_sequence: {
			open: false,
		},
	} as LLMParametersValue)

	const LLMOptions = useMemo(() => {
		return [
			{
				value: "chatgpt-3.5",
				label: "GPT 3.5",
				tags: [
					{
						type: LLMLabelTagType.Text,
						value: "微软Azure",
					},
					{
						type: LLMLabelTagType.Icon,
						value: "icon-message",
					},
				],
			},
		]
	}, [])

	const onLLMValueChange = useMemoizedFn((value: LLMParametersValue) => {
		setLLMValue(value)
		form?.setFieldsValue({
			llm: value,
		})
	})

	const initialValues = useMemo(() => {
		const nodeParams =
			currentNode?.params || _.cloneDeep(templateMap[customNodeType.LLM].v0.params)
		if (!nodeParams)
			return {
				temperature: LLMValue.temperature,
			}
		// @ts-ignore
		const { model, model_config, ...rest } = nodeParams
		return {
			llm: {
				...LLMValue,
				model,
				...(model_config || {}),
			},
			...rest,
		}
	}, [LLMValue, currentNode?.params])

	useMount(() => {
		setLLMValue({
			...currentNode?.params?.model_config,
		})
	})

	return {
		LLMOptions,
		LLMValue,
		onLLMValueChange,
		initialValues,
	}
}
