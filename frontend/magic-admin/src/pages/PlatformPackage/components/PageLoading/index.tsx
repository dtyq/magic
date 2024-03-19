import { createStyles } from "antd-style"
import { memo } from "react"
import { MagicSpin } from "components"

const useStyles = createStyles(({ css }) => {
	return {
		wrapper: css`
			display: flex;
			justify-content: center;
			align-items: center;
			height: 100%;
			width: 100%;
		`,
	}
})

const PageLoading = () => {
	const { styles } = useStyles()
	return (
		<div className={styles.wrapper}>
			<MagicSpin spinning />
		</div>
	)
}

export default memo(PageLoading)
