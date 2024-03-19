/**
 * LLM参数配置器
 */
import { Form, Switch, Tooltip } from "antd"
import { IconHelp } from "@tabler/icons-react"
import { useMemoizedFn } from "ahooks"
import { set, get } from "lodash-es"
import MagicInput from "@dtyq/magic-flow/dist/common/BaseUI/Input"
import type { LLMOption } from "@/opensource/pages/flow/nodes/LLM/v0/components/LLMSelect"
import LLMSelectV0 from "@/opensource/pages/flow/nodes/LLM/v0/components/LLMSelect"
import { useTranslation } from "react-i18next"
import useLLMParameters from "./hooks/useLLMParameters"
import styles from "./index.module.less"

export type LLMParametersValue = {
	max_record: number
	model: string
	auto_memory: boolean
}

type LLMParametersProps = {
	LLMValue: LLMParametersValue
	onChange: (value: LLMParametersValue) => void
	options: LLMOption[]
	formValues: any
}

export default function LLMParameters({
	LLMValue,
	onChange,
	options,
	formValues,
}: LLMParametersProps) {
	const { t } = useTranslation()
	const { autoMemory, maxRecord } = useLLMParameters()

	// 处理单个项变更事件
	const onParamChanged = useMemoizedFn((key: string | string[], newValue: any) => {
		set(LLMValue, key, newValue)
		const model = formValues?.llm?.model
		onChange({
			...LLMValue,
			model,
		})
	})

	const LLMPanel = useMemoizedFn(() => {
		return (
			<div className={styles.panel} onClick={(e) => e.stopPropagation()}>
				<div className={styles.header}>
					<span className={styles.h1Title}>{t("common.model", { ns: "flow" })}</span>
					<Form.Item name={["llm", "model"]}>
						{/* @ts-ignore */}
						<LLMSelectV0 options={options} className={styles.LLMSelect} />
					</Form.Item>
				</div>
				<div className={styles.body}>
					<div className={styles.parameters}>
						<div className={styles.left}>
							<span className={styles.title}>{maxRecord.label}</span>
							<Tooltip title={maxRecord.tooltips}>
								<IconHelp size={16} color="#1C1D2399" className={styles.icon} />
							</Tooltip>
						</div>
						<div className={styles.right}>
							<MagicInput
								value={get(LLMValue, [maxRecord.key], maxRecord.defaultValue)}
								onChange={(e: any) =>
									onParamChanged([maxRecord.key], parseInt(e.target.value, 10))
								}
								className={styles.input}
								type="number"
							/>
						</div>
					</div>
					<div className={styles.parameters}>
						<div className={styles.left}>
							<span className={styles.title}>{autoMemory.label}</span>
							<Tooltip title={autoMemory.tooltips}>
								<IconHelp size={16} color="#1C1D2399" className={styles.icon} />
							</Tooltip>
						</div>
						<div>
							<Switch
								checked={get(LLMValue, [autoMemory.key], autoMemory.defaultValue)}
								onChange={(value) => onParamChanged([autoMemory.key], value)}
								className={styles.slider}
							/>
						</div>
					</div>
				</div>
			</div>
		)
	})

	return (
		<LLMSelectV0
			value={formValues?.llm?.model}
			className={styles.LLMParameters}
			options={options}
			dropdownRenderProps={{
				component: LLMPanel,
			}}
			showLLMSuffixIcon
		/>
	)
}
