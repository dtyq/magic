/**
 * 类型转化器
 */

import { Flex, Form, Switch } from "antd"
import { useMemo } from "react"
import { useToggle } from "ahooks"
import { useTranslation } from "react-i18next"
import styles from "../index.module.less"

export enum CodeMode {
	Normal = "normal",
	Expression = "import_code",
}

export default function useMode() {
	const { t } = useTranslation()
	const [mode, { toggle, set }] = useToggle(CodeMode.Normal, CodeMode.Expression)

	const ModeChanger = useMemo(() => {
		return (
			<Flex className={styles.modeWrap} align="center" gap={6}>
				<span className={styles.text}>{t("common.mode", { ns: "flow" })}</span>
				<Form.Item name="mode" valuePropName="checked">
					<Switch
						checkedChildren={t("code.codeEditor", { ns: "flow" })}
						unCheckedChildren={t("code.expression", { ns: "flow" })}
						checked={mode === CodeMode.Normal}
						onChange={toggle}
					/>
				</Form.Item>
			</Flex>
		)
	}, [mode, t, toggle])

	return {
		ModeChanger,
		mode,
		setMode: set,
	}
}
