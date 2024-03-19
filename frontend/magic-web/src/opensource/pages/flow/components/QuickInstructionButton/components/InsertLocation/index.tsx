import { memo, useMemo } from "react"
import { useTranslation } from "react-i18next"
import { Flex, Form, Radio } from "antd"
import { useStyles } from "../../styles"
import { INSERT_OPTIONS } from "../../const"

export const InsertLocation = memo(function InsertLocation() {
	const { t } = useTranslation("interface")
	const { styles } = useStyles()

	const options = useMemo(() => INSERT_OPTIONS(t), [t])

	return (
		<Flex gap={8} vertical>
			<div className={styles.formSubTitle}>{t("explore.form.insertLocation")}</div>
			<div className={styles.desc}>{t("explore.form.insertLocationTip")}</div>
			<Form.Item noStyle name="insert_location" initialValue={options[0].value}>
				<Radio.Group className={styles.radioGroup} options={options} />
			</Form.Item>
		</Flex>
	)
})
