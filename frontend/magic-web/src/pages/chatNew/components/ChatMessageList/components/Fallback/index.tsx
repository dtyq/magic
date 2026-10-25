import { useTranslation } from "react-i18next"
import { memo } from "react"
import useStyles from "./style"

const Fallback = memo(() => {
	const { t } = useTranslation("message")
	const { styles } = useStyles({})

	return <div className={styles.text}>{t("chat.NotSupport")}</div>
})

export default Fallback
