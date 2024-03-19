/**
 * LLM参数配置器
 */
import { Form, Switch, Tooltip } from "antd"
import { IconHelp } from "@tabler/icons-react"
import { useMemoizedFn } from "ahooks"
import MagicInput from "@dtyq/magic-flow/dist/common/BaseUI/Input"
import MagicSlider from "@dtyq/magic-flow/dist/common/BaseUI/Slider"
import { useFlowStore } from "@/opensource/stores/flow"
import { useTranslation } from "react-i18next"
import { createStyles } from "antd-style"
import LLMSelect from "../LLMSelect"
import useLLMParameters from "./hooks/useLLMParameters"

export type LLMParametersValue = {
	temperature: string | number
	model: string
	auto_memory: boolean
	max_record: number
}

const useStyles = createStyles(({ css, token }) => {
	return {
		LLMParameters: css`
			.magic-switch-checked {
				background-color: ${token.colorPrimary};
			}
			.magic-slider-handle {
				margin-top: 0;
			}
			.magic-select-dropdown {
				overflow: visible;
			}
			.magic-select-selector {
				padding: 0 11px 0 3px !important;
			}
		`,
		panel: css``,
		header: css`
			height: 56px;
			display: flex;
			padding: 0 12px;
			justify-content: space-between;
			align-items: center;
		`,
		h1Title: css`
			font-weight: 600;
			line-height: 20px;
			font-size: 14px;
			color: ${token.colorText};
		`,
		LLMSelect: css`
			width: 400px !important;
		`,
		body: css`
			border-top: 1px solid ${token.colorBorderSecondary};
			padding: 11px 12px;
		`,
		parameters: css`
			margin-bottom: 10px;
			display: flex;
			align-items: center;
			justify-content: space-between;
		`,
		left: css`
			display: flex;
			align-items: center;
		`,
		title: css`
			line-height: 20px;
			font-size: 14px;
			color: ${token.colorText};
		`,
		icon: css`
			margin-left: 2px;
		`,
		switch: css`
			margin-left: 12px;
		`,
		right: css`
			width: 300px;
			display: flex;
			align-items: center;
			justify-content: flex-end;
		`,
		slider: css`
			width: 224px;
			display: flex;
			align-items: center;
			margin-right: 16px;
		`,
		input: css`
			width: 68px;
		`,
		formItem: css`
			padding: 0 12px 12px 12px !important;
			.magic-form-item-label {
				margin-bottom: 6px;
			}
		`,
	}
})

export default function LLMParametersV0() {
	const { t } = useTranslation()
	const { autoMemory, temperature, maxRecord } = useLLMParameters()
	const { styles } = useStyles()

	const { models: options } = useFlowStore()

	// console.log(LLMValue)

	// const addJustOptions = useMemo(() => {
	// 	return [
	// 		{
	// 			label: (
	// 				<div className={styles.label}>
	// 					<IconBulb color="#FF7D00" stroke={1} className={styles.icon} />
	// 					<span>创意</span>
	// 				</div>
	// 			),
	// 			value: LLMAdjust.Creativity,
	// 		},
	// 		{
	// 			label: (
	// 				<div className={styles.label}>
	// 					<IconScale color="#315CEC" stroke={1} className={styles.icon} />
	// 					<span>平衡</span>
	// 				</div>
	// 			),
	// 			value: LLMAdjust.Balanced,
	// 		},

	// 		{
	// 			label: (
	// 				<div className={styles.label}>
	// 					<IconTargetArrow color="#32C436" stroke={1} className={styles.icon} />
	// 					<span>精准</span>
	// 				</div>
	// 			),
	// 			value: LLMAdjust.Precise,
	// 		},

	// 		{
	// 			label: (
	// 				<div className={styles.label}>
	// 					<IconAdjustmentsHorizontal
	// 						color="#1C1D23"
	// 						stroke={1}
	// 						size={18}
	// 						className={styles.icon}
	// 					/>
	// 					<span>加载预设</span>
	// 				</div>
	// 			),
	// 			value: LLMAdjust.default,
	// 			visible: false,
	// 		},
	// 	]
	// }, [])

	// const [adjustValue, setAdjustValue] = useState(LLMAdjust.default)

	// useUpdateEffect(() => {
	// 	const adjustParameters = _.get(LLMAdjustMap, [adjustValue], null)
	// 	if (!adjustParameters) return
	// 	const model = formValues?.llm?.model
	// 	onChange({
	// 		...LLMValue,
	// 		...adjustParameters,
	// 		model,
	// 	})
	// }, [adjustValue])

	const LLMPanel = useMemoizedFn(() => {
		return (
			<div className={styles.panel} onClick={(e) => e.stopPropagation()}>
				<div className={styles.header}>
					<span className={styles.h1Title}>{t("common.model", { ns: "flow" })}</span>
					<Form.Item name={["model"]}>
						<LLMSelect options={options} className={styles.LLMSelect} />
					</Form.Item>
				</div>
				<div className={styles.body}>
					{/* <div className={styles.preSettings}>
						<span className={styles.h1Title}>参数</span>
						<MagicSelect
							value={LLMAdjust.default}
							options={addJustOptions}
							onChange={(value: LLMAdjust) => setAdjustValue(value)}
							dropdownRenderProps={{
								placeholder: "搜索卡片类型",
								component: BaseDropdownRenderer,
								showSearch: false,
							}}
							className={styles.preSettingsSelect}
						/>
					</div> */}

					<div className={styles.parameters}>
						<div className={styles.left}>
							<span className={styles.title}>{temperature.label}</span>
							<Tooltip title={temperature.tooltips}>
								<IconHelp size={16} color="#1C1D2399" className={styles.icon} />
							</Tooltip>
						</div>
						<div className={styles.right}>
							<Form.Item
								name={["model_config", "temperature"]}
								className={styles.right}
							>
								<MagicSlider
									min={temperature.extra.min}
									max={temperature.extra.max}
									step={temperature.extra.step}
									className={styles.slider}
								/>
							</Form.Item>
							<Form.Item
								name={["model_config", "temperature"]}
								className={styles.right}
							>
								<MagicInput
									className={styles.input}
									type="number"
									min={temperature.extra.min}
									max={temperature.extra.max}
									step={temperature.extra.step}
								/>
							</Form.Item>
						</div>
					</div>
					<div className={styles.parameters}>
						<div className={styles.left}>
							<span className={styles.title}>{autoMemory.label}</span>
							<Tooltip title={autoMemory.tooltips}>
								<IconHelp size={16} color="#1C1D2399" className={styles.icon} />
							</Tooltip>
						</div>
						<Form.Item name={["model_config", "auto_memory"]} valuePropName="checked">
							<Switch />
						</Form.Item>
					</div>
					<div className={styles.parameters}>
						<div className={styles.left}>
							<span className={styles.title}>{maxRecord.label}</span>
							<Tooltip title={maxRecord.tooltips}>
								<IconHelp size={16} color="#1C1D2399" className={styles.icon} />
							</Tooltip>
						</div>
						<Form.Item className={styles.right} name={["model_config", "max_record"]}>
							<MagicInput className={styles.input} type="number" />
						</Form.Item>
					</div>
					{/* {parameterList.map((parameter) => {
						return (
							<div className={styles.parameters} key={parameter.label}>
								<div className={styles.left}>
									<span className={styles.title}>{parameter.label}</span>
									<Tooltip title={parameter.tooltips}>
										<IconHelp
											size={16}
											color="#1C1D2399"
											className={styles.icon}
										/>
									</Tooltip>
									<Switch
										className={styles.switch}
										size="small"
										checked={_.get(
											LLMValue,
											[parameter.key, "open"],
											parameter.open,
										)}
										onChange={(value) =>
											onParamChanged([parameter.key, "open"], value)
										}
									/>
								</div>
								<div className={styles.right}>
									<MagicSlider
										min={parameter.extra.min}
										max={parameter.extra.max}
										step={parameter.extra.step}
										value={_.get(
											LLMValue,
											[parameter.key, "value"],
											parameter.defaultValue,
										)}
										onChange={(value) =>
											onParamChanged([parameter.key, "value"], value)
										}
										className={styles.slider}
									/>
									<MagicInput
										value={_.get(
											LLMValue,
											[parameter.key, "value"],
											parameter.defaultValue,
										)}
										onChange={(e: any) =>
											onParamChanged([parameter.key, "value"], e.target.value)
										}
										className={styles.input}
										type="number"
										min={parameter.extra.min}
										max={parameter.extra.max}
										step={parameter.extra.step}
									/>
								</div>
							</div>
						)
					})} */}

					{/* <div className={styles.parameters}>
						<div className={styles.left}>
							<span className={styles.title}>回复格式</span>
							<Tooltip title="指定模型必须输出的格式。">
								<IconHelp size={16} color="#1C1D2399" className={styles.icon} />
							</Tooltip>
							<Switch
								className={styles.switch}
								size="small"
								checked={_.get(LLMValue, ["ask_type", "open"], false)}
								onChange={(value) => onParamChanged(["ask_type", "open"], value)}
							/>
						</div>
						<div className={styles.right}>
							<MagicSelect
								options={[
									{
										label: <span className={styles.option}>JSON</span>,
										value: "json",
									},
									{
										label: <span className={styles.option}>Text</span>,
										value: "text",
									},
								]}
								value={_.get(LLMValue, ["ask_type", "value"], null)}
								onChange={(value: string) =>
									onParamChanged(["ask_type", "value"], value)
								}
								placeholder="请选择"
								dropdownRenderProps={{
									showSearch: false,
									component: BaseDropdownRenderer,
								}}
							/>
						</div>
					</div>

					<div className={styles.parameters}>
						<div className={styles.left}>
							<span className={styles.title}>停止序列</span>
							<Tooltip title="最多四个序列，API 将停止生成更多的 token。返回的文本将不包含停止序列。">
								<IconHelp size={16} color="#1C1D2399" className={styles.icon} />
							</Tooltip>
							<Switch
								className={styles.switch}
								size="small"
								checked={_.get(LLMValue, ["stop_sequence", "open"], false)}
								onChange={(value) =>
									onParamChanged(["stop_sequence", "open"], value)
								}
							/>
						</div>
						<div className={styles.right}>
							<TagsSelect
								value={_.get(LLMValue, ["stop_sequence", "value"], [])}
								onChange={(value) =>
									onParamChanged(["stop_sequence", "value"], value)
								}
								placeholder="输入序列并按 Tab 键"
							/>
						</div>
					</div> */}
				</div>
			</div>
		)
	})

	return (
		<Form.Item name={["model"]} className={styles.formItem} label="模型">
			<LLMSelect
				className={styles.LLMParameters}
				options={options}
				dropdownRenderProps={{
					component: LLMPanel,
				}}
				showLLMSuffixIcon
			/>
		</Form.Item>
	)
}
