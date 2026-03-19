import type { FormInstance } from "antd"
import { useMemoizedFn, useMount } from "ahooks"
import { useMemo, useState } from "react"
import { useCurrentNode } from "@dtyq/magic-flow/dist/MagicFlow/nodes/common/context/CurrentNode/useCurrentNode"
import useSWRImmutable from "swr/immutable"

import { cloneDeep } from "lodash-es"
import { FlowApi } from "@/apis"
import type { LLMParametersValue } from "../components/LLMParameters"
import { v0Template } from "../template"

type UseLLM = {
	form: FormInstance<any>
}

export default function useLLM({ form }: UseLLM) {
	const { currentNode } = useCurrentNode()

	const [LLMValue, setLLMValue] = useState({
		model: "",
		max_record: 0.7,
		auto_memory: true,
		// top_p: {
		// 	open: false,
		// 	value: 1,
		// },
		// exist_penalty: {
		// 	open: false,
		// 	value: 0,
		// },
		// frequency_penalty: {
		// 	open: false,
		// 	value: 0,
		// },
		// max_tags: {
		// 	open: false,
		// 	value: 512,
		// },
		// ask_type: {
		// 	open: false,
		// },
		// stop_sequence: {
		// 	open: false,
		// },
	} as LLMParametersValue)

	const { data } = useSWRImmutable("/api/v1/flows/models", () => FlowApi.getLLMModal())

	const onLLMValueChange = useMemoizedFn((value: LLMParametersValue) => {
		setLLMValue(value)
		const preValue = form.getFieldValue("llm")
		form?.setFieldsValue({
			llm: { ...preValue, ...value },
		})
	})

	const initialValues = useMemo(() => {
		const cloneTemplate = cloneDeep(v0Template)
		const nodeParams = currentNode?.params || cloneDeep(v0Template.params)
		if (!nodeParams)
			return {
				max_record: LLMValue.max_record,
				auto_memory: LLMValue.auto_memory,
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
			input: currentNode?.input || cloneTemplate?.input,
		}
	}, [LLMValue, currentNode?.input, currentNode?.params])

	useMount(() => {
		setLLMValue({
			...currentNode?.params?.model_config,
		})
	})

	return {
		LLMOptions: data?.models ?? [],
		LLMValue,
		onLLMValueChange,
		initialValues,
	}
}
