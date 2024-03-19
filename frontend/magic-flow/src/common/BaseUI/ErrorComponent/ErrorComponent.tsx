import { Flex } from "antd"
import i18next from "i18next"
import React from "react"
import styles from "./ErrorComponent.module.less"

function ErrorContent() {
	return (
		<Flex className={styles.invalidText} justify="space-between" align="center" gap={10}>
			<div className={styles.invalidText}>
				{i18next.t("common.renderError", { ns: "magicFlow" })}
			</div>
		</Flex>
	)
}

export default ErrorContent
