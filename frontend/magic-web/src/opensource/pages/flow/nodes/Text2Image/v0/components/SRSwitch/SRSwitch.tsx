/**
 * 是否开启超分的Switch
 */

import { Flex, Switch } from "antd"
import { useTranslation } from "react-i18next"
import styles from "./SRSwitch.module.less"

type SRSwitchProps = {
	value?: boolean
	onChange?: (checked: boolean) => void
}

export default function SRSwitch({ value, onChange }: SRSwitchProps) {
	const { t } = useTranslation()
	return (
		<Flex className={styles.srswitchWrap} align="center" justify="space-between">
			<Flex gap={6} align="center">
				<Switch value={value} onChange={onChange} size="small" />
				<span>{t("text2Image.enableSR", { ns: "flow" })}</span>
			</Flex>
			<span className={styles.tips}>{t("text2Image.enableSRDesc", { ns: "flow" })}</span>
		</Flex>
	)
}
