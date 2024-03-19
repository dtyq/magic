import MagicButton from "@/opensource/components/base/MagicButton"
import { Flex } from "antd"
import { createStyles } from "antd-style"
import type { ComponentProps } from "react"

const useStyles = createStyles(({ css, token }) => ({
	container: css`
		padding: 7px;
		width: 100%;
		min-width: 340px;
	`,
	invalidText: css`
		color: ${token.magicColorUsages.text[2]};
		text-align: justify;
		font-size: 14px;
		line-height: 20px;
		white-space: pre-wrap;
	`,
}))

interface ErrorContentProps extends ComponentProps<"div"> {
	onReport?: () => void
	onRetry?: () => void
}

function ErrorContent({ onReport, onRetry, className, ...props }: ErrorContentProps) {
	const { styles, cx } = useStyles()

	return (
		<Flex
			vertical
			className={cx(styles.invalidText, className)}
			justify="center"
			align="center"
			gap={10}
			{...props}
		>
			<div className={styles.invalidText}>
				未知的错误原因导致无法正常渲染内容，请联系 Magic 开发团队。
			</div>
			{onReport && (
				<MagicButton type="link" onClick={onReport}>
					上报异常错误
				</MagicButton>
			)}
			{onRetry && (
				<MagicButton type="link" onClick={onRetry}>
					重试
				</MagicButton>
			)}
		</Flex>
	)
}

export default ErrorContent
