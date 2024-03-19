import { useMemo } from "react"

export default function useLLMParameters() {
	const parameterList = useMemo(() => {
		return [
			{
				label: "温度",
				key: "temperature",
				tooltips:
					"温度控制随机性。较低的温度会导致较少的随机完成。随着温度接近零，模型将变得确定性和重复性。较高的温度会导致更多的随机完成。",
				open: true,
				defaultValue: 0.7,
				extra: {
					step: 0.1,
					max: 1,
					min: 0,
				},
			},

			{
				label: "Top P",
				key: "top_p",
				tooltips: "通过核心采样控制多样性：0.5表示考虑了一半的所有可能性加权选项。",
				open: false,
				defaultValue: 1,
				extra: {
					step: 0.1,
					max: 1,
					min: 0,
				},
			},

			{
				label: "存在惩罚",
				key: "exist_penalty",
				tooltips: "对文本中已有的标记的对数概率施加惩罚。",
				open: false,
				defaultValue: 0,
				extra: {
					step: 0.1,
					max: 1,
					min: 0,
				},
			},

			{
				label: "频率惩罚",
				key: "frequency_penalty",
				tooltips: "对文本中出现的标记的对数概率施加惩罚。",
				open: false,
				defaultValue: 0,
				extra: {
					step: 0.1,
					max: 1,
					min: 0,
				},
			},

			{
				label: "最大标记",
				key: "max_tags",
				tooltips: "指定生成结果长度的上限。如果生成结果截断，可以调大该参数。",
				open: false,
				defaultValue: 512,
				extra: {
					step: 1,
					max: 4096,
					min: 1,
				},
			},
		]
	}, [])

	return {
		parameterList,
	}
}
