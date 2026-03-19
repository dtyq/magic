import { Flex, Form, Input, Switch } from "antd"
import { useTranslation } from "react-i18next"
import { memo } from "react"
import { useStyles } from "../../styles"

const SwitchOption = memo(() => {
	const { t } = useTranslation("interface")
	const { styles, cx } = useStyles()
	return (
		<Flex vertical gap={6}>
			<Flex gap={6} align="middle">
				<div style={{ minWidth: 80 }} />
				<span className={styles.optionText}>{t("explore.form.optionValue")}</span>
				<span className={cx(styles.optionText, styles.optionShortText)}>
					{t("explore.form.defaultValue")}
				</span>
			</Flex>
			<Flex gap={6} align="center">
				<span className={styles.labelText} style={{ minWidth: 80 }}>
					{t("explore.form.open")}
				</span>
				<Form.Item
					name="on"
					rules={[
						{
							required: true,
							message: t("explore.form.optionValuePlaceholder"),
						},
					]}
					style={{ flex: 1 }}
				>
					<Input className={styles.input} />
				</Form.Item>
				<Form.Item name="switch_on" noStyle initialValue>
					<Switch className={styles.switch} />
				</Form.Item>
			</Flex>
			<Flex gap={6} align="center">
				<span className={styles.labelText} style={{ minWidth: 80 }}>
					{t("explore.form.close")}
				</span>
				<Form.Item
					name="off"
					rules={[
						{
							required: true,
							message: t("explore.form.optionValuePlaceholder"),
						},
					]}
					style={{ flex: 1 }}
				>
					<Input className={styles.input} />
				</Form.Item>
				<Form.Item name="switch_off" noStyle>
					<Switch className={styles.switch} />
				</Form.Item>
			</Flex>
			<div className={styles.desc}>{t("explore.form.instructionSwitchTip")}</div>
		</Flex>
	)
})

export default SwitchOption
