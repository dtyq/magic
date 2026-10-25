import { memo, useMemo } from "react"
import { Col, Form, InputNumber, Row } from "antd"
import { useTranslation } from "react-i18next"
import { MagicSelect } from "@admin-components"
import { AiModel } from "@admin/const/aiModel"
import { useStyles } from "../AddModelModal/styles"

// 仅用于下拉框展示，表单及接口仍使用固定温度类型。
const DISABLED_TEMPERATURE = "disabled"

/** 模型温度 */
const ModelTemperature = ({ isOfficialOrg }: { isOfficialOrg?: boolean }) => {
	const { t } = useTranslation("admin/ai/model")
	const { styles } = useStyles()
	const form = Form.useFormInstance()
	const temperatureType = Form.useWatch(["config", "temperature_type"], form)
	const temperature = Form.useWatch(["config", "temperature"], form)
	const isTemperatureDisabled =
		temperatureType === AiModel.ModelTemperatureType.Fixed && temperature === 0

	/** 将关闭选项转换为固定温度零，切回可调模式时恢复默认温度。 */
	const getTemperatureTypeFromEvent = (
		value: AiModel.ModelTemperatureType | typeof DISABLED_TEMPERATURE,
	) => {
		if (value === DISABLED_TEMPERATURE) {
			form.setFieldValue(["config", "temperature"], 0)
			return AiModel.ModelTemperatureType.Fixed
		}
		if (isTemperatureDisabled) form.setFieldValue(["config", "temperature"], 0.8)
		return value
	}

	/** 固定温度零统一回显为关闭温度，保持保存前后的展示一致。 */
	const getTemperatureTypeValueProps = (value: AiModel.ModelTemperatureType) => ({
		value: isTemperatureDisabled ? DISABLED_TEMPERATURE : value,
	})

	const options = useMemo(() => {
		return [
			{
				label: t("form.recommendedTemperature"),
				value: AiModel.ModelTemperatureType.Recommended,
			},
			{ label: t("form.fixedTemperature"), value: AiModel.ModelTemperatureType.Fixed },
			{ label: t("form.disabledTemperature"), value: DISABLED_TEMPERATURE },
		]
	}, [t])

	return (
		<Form.Item
			label={t("form.creativeTemperature")}
			className={styles.formItem}
			hidden={!isOfficialOrg}
		>
			<Row gutter={[6, 6]}>
				<Col span={12}>
					<Form.Item
						name={["config", "temperature_type"]}
						noStyle
						initialValue={AiModel.ModelTemperatureType.Recommended}
						getValueProps={getTemperatureTypeValueProps}
						getValueFromEvent={getTemperatureTypeFromEvent}
					>
						<MagicSelect options={options} />
					</Form.Item>
				</Col>
				{/* 关闭时隐藏数值列，保留字段挂载以继续监听和提交固定温度零。 */}
				<Col span={isTemperatureDisabled ? 0 : 12}>
					<Form.Item
						name={["config", "temperature"]}
						rules={isOfficialOrg ? [{ required: true, message: "" }] : []}
						initialValue={0.8}
						noStyle
					>
						<InputNumber
							min={0}
							max={2}
							step={0.1}
							disabled={isTemperatureDisabled}
							className={styles.inputNumber}
						/>
					</Form.Item>
				</Col>
			</Row>
		</Form.Item>
	)
}

export default memo(ModelTemperature)
