import { createStyles } from "antd-style"
import { memo } from "react"
import { useTranslation } from "react-i18next"
import MagicSpin from "../../base/MagicSpin"

const useStyles = createStyles(({ css, prefixCls }) => ({
	spin: css`
    height: 100%;
    .${prefixCls}-spin-blur {
        opacity: 1;
    }

    & > div > .${prefixCls}-spin {
        --${prefixCls}-spin-content-height: unset;
        max-height: unset;
    }
`,
}))

const FullSpin = memo(() => {
	const { t } = useTranslation("interface")
	const { styles } = useStyles()
	return (
		<MagicSpin spinning className={styles.spin} tip={t("spin.loading")}>
			<div style={{ height: "100vh" }} />
		</MagicSpin>
	)
})

export default FullSpin
