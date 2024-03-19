import { createStyles } from "antd-style"
import { Input } from "antd"

const useStyles = createStyles(({ css, token }) => {
	return {
		wrapper: css`
			width: 100%;
			display: flex;
			flex-direction: column;
			gap: 10px;
		`,
		header: css`
			color: ${token.magicColorUsages.text[1]};
			font-size: 16px;
			font-style: normal;
			font-weight: 600;
			line-height: 22px; /* 137.5% */
		`,
		container: css`
			width: 100%;
			display: flex;
			flex: auto;
		`,
	}
})

export default function FileSource() {
	const { styles } = useStyles()
	return (
		<div className={styles.wrapper}>
			<div className={styles.header}>上传文件</div>
			<div className={styles.container}>
				<Input.TextArea />
			</div>
		</div>
	)
}
