import { memo, useMemo } from "react"
import { Col, Form, InputNumber, Row } from "antd"
import { useTranslation } from "react-i18next"
import { MagicSelect } from "components"
import { AiModel } from "@/const/aiModel"
import { useStyles } from "../AddModelModal/styles"

/** 模型温度 */
const ModelTemperature = ({ isOfficialOrg }: { isOfficialOrg?: boolean }) => {
	const { t } = useTranslation("admin/ai/model")
	const { styles } = useStyles()

	const options = useMemo(() => {
		return [
			{
				label: t("form.recommendedTemperature"),
				value: AiModel.ModelTemperatureType.Recommended,
			},
			{ label: t("form.fixedTemperature"), value: AiModel.ModelTemperatureType.Fixed },
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
					>
						<MagicSelect options={options} />
					</Form.Item>
				</Col>
				<Col span={12}>
					<Form.Item
						name={["config", "temperature"]}
						rules={isOfficialOrg ? [{ required: true, message: "" }] : []}
						initialValue={0.8}
						noStyle
					>
						<InputNumber min={0} max={2} step={0.1} className={styles.inputNumber} />
					</Form.Item>
				</Col>
			</Row>
		</Form.Item>
	)
}

export default memo(ModelTemperature)
