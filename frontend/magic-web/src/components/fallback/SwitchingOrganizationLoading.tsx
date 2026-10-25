import { PropsWithChildren } from "react"
import { MagicSpin } from "@/components/base"
import { createStyles } from "antd-style"
import { interfaceStore } from "@/stores/interface"
import { observer } from "mobx-react-lite"
import { useMainTranslation } from "@/hooks/i18n/useMainTranslation"

export const useStyles = createStyles(({ isDarkMode, css, prefixCls, token }) => ({
	spin: css`
		.${prefixCls}-spin-blur {
			opacity: 1;
		}

		.${prefixCls}-spin {
			--${prefixCls}-spin-content-height: unset;
		}
	`,
	container: css`
		background-color: ${
			isDarkMode ? token.magicColorUsages.black : token.magicColorUsages.white
		};
		height: 100vh;
		width: 100%;
	`,
}))

const SwitchingOrganizationLoading = observer(({ children }: PropsWithChildren) => {
	const { t } = useMainTranslation("interface")
	const { styles } = useStyles()
	if (interfaceStore.isSwitchingOrganization) {
		return (
			<MagicSpin tip={t("spin.loadingUserInfo")} wrapperClassName={styles.spin}>
				<div className={styles.container} />
			</MagicSpin>
		)
	}

	return children
})

export default SwitchingOrganizationLoading
