/**
 * LLM参数配置器
 */
import BaseDropdownRenderer from "@/common/BaseUI/DropdownRenderer/Base"
import MagicInput from "@/common/BaseUI/Input"
import { default as MagicSelect, default as TsSelect } from "@/common/BaseUI/Select"
import MagicSlider from "@/common/BaseUI/Slider"
import { Switch, Tooltip } from "antd"
import {
	IconAdjustmentsHorizontal,
	IconBulb,
	IconHelp,
	IconScale,
	IconTargetArrow,
} from "@tabler/icons-react"
import { useMemoizedFn, useUpdateEffect } from "ahooks"
import _ from "lodash"
import React, { useMemo, useState } from "react"
import LLMSelect, { LLMOption } from "../LLMSelect"
import TagsSelect from "./TagsSelect"
import { LLMAdjust, LLMAdjustMap } from "./constants"
import useLLMParameters from "./hooks/useLLMParameters"
import styles from "./index.module.less"

export type LLMParametersValue = {
	model: string
	temperature: {
		open: boolean
		value: string | number
	}
}

type LLMParameters = {
	LLMValue: LLMParametersValue
	onChange: (value: LLMParametersValue) => void
	options: LLMOption[]
}

export default function LLMParameters({ LLMValue, onChange, options }: LLMParameters) {
	const { parameterList } = useLLMParameters()
	// console.log(LLMValue)

	// 处理单个项变更事件
	const onParamChanged = useMemoizedFn((key: string | string[], newValue: any) => {
		_.set(LLMValue, key, newValue)
		onChange({
			...LLMValue,
		})
	})

	const addJustOptions = useMemo(() => {
		return [
			{
				label: (
					<div className={styles.label}>
						<IconBulb color="#FF7D00" stroke={1} className={styles.icon} />
						<span>创意</span>
					</div>
				),
				value: LLMAdjust.Creativity,
			},
			{
				label: (
					<div className={styles.label}>
						<IconScale color="#315CEC" stroke={1} className={styles.icon} />
						<span>平衡</span>
					</div>
				),
				value: LLMAdjust.Balanced,
			},

			{
				label: (
					<div className={styles.label}>
						<IconTargetArrow color="#32C436" stroke={1} className={styles.icon} />
						<span>精准</span>
					</div>
				),
				value: LLMAdjust.Precise,
			},

			{
				label: (
					<div className={styles.label}>
						<IconAdjustmentsHorizontal
							color="#1C1D23"
							stroke={1}
							size={18}
							className={styles.icon}
						/>
						<span>加载预设</span>
					</div>
				),
				value: LLMAdjust.default,
				visible: false,
			},
		]
	}, [])

	const [adjustValue, setAdjustValue] = useState(LLMAdjust.default)

	useUpdateEffect(() => {
		const adjustParameters = _.get(LLMAdjustMap, [adjustValue], null)
		if (!adjustParameters) return
		onChange({
			...LLMValue,
			...adjustParameters,
		})
	}, [adjustValue, LLMValue])

	const LLMPanel = useMemoizedFn(() => {
		return (
			<div className={styles.panel}>
				<div className={styles.header}>
					<span className={styles.h1Title}>模型</span>
					<LLMSelect
						value={LLMValue?.model}
						onChange={(value) => onParamChanged("model", value)}
						options={options}
						className={styles.LLMSelect}
					/>
				</div>
				<div className={styles.body}>
					<div className={styles.preSettings}>
						<span className={styles.h1Title}>参数</span>
						<TsSelect
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
					</div>
					{parameterList.map((parameter) => {
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
					})}

					<div className={styles.parameters}>
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
					</div>
				</div>
			</div>
		)
	})

	return (
		<LLMSelect
			value={LLMValue?.model}
			className={styles.LLMParameters}
			options={options}
			dropdownRenderProps={{
				component: LLMPanel,
			}}
			placeholder="请配置LLM参数"
			showLLMSuffixIcon
		/>
	)
}
