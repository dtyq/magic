import { memo } from "react"
import { useTranslation } from "react-i18next"
import { Flex, Form, Switch } from "antd"
import { useStyles } from "../../styles"

export const InstructionResidency = memo(
	({ onHiddenInsertLocation }: { onHiddenInsertLocation: (checked: boolean) => void }) => {
		const { t } = useTranslation("interface")
		const { styles } = useStyles()

		return (
			<Flex vertical gap={6}>
				<Flex gap={10} align="center">
					<div className={styles.formSubTitle}>
						{t("explore.form.instructionResidency")}
					</div>
					<Form.Item noStyle name="residency">
						<Switch
							className={styles.switch}
							onChange={(checked) => {
								onHiddenInsertLocation(checked)
							}}
						/>
					</Form.Item>
				</Flex>
				<div className={styles.desc}>{t("explore.form.instructionResidencyTip")}</div>
			</Flex>
		)
	},
)
