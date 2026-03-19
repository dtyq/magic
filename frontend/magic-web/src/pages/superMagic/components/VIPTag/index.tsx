import { createStyles } from "antd-style"

const useStyles = createStyles(({ css, token }) => ({
	wrapper: css`
		position: relative;
		height: 12px;
		padding: 1px 4px;
		border-radius: 100px;
		background: linear-gradient(128deg, #3f8fff 5.59%, #ef2fdf 95.08%);
		display: inline-flex;
		align-items: center;
		justify-content: center;

		&::before {
			content: "";
			position: absolute;
			inset: 1px;
			border-radius: 100px;
			background: ${token.colorBgContainer};
		}
	`,
	text: css`
		font-family: Inter;
		font-size: 10px;
		line-height: 12px;
		position: relative;
		z-index: 1;
		background: linear-gradient(128deg, #3f8fff 5.59%, #ef2fdf 95.08%);
		-webkit-background-clip: text;
		-webkit-text-fill-color: transparent;
	`,
}))
export default function VIPTag() {
	const { styles } = useStyles()
	return (
		<div className={styles.wrapper}>
			<span className={styles.text}>VIP</span>
		</div>
	)
}
