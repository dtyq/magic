import { Tag, type TagProps } from "antd"
import { createStyles } from "antd-style"
import MagicIcon from "@/opensource/components/base/MagicIcon"
import { IconX } from "@tabler/icons-react"

const useStyles = createStyles(({ css, prefixCls, token }) => ({
	tag: css`
		--${prefixCls}-tag-default-bg: ${token.magicColorUsages.fill[0]} !important;
		--${prefixCls}-color-border: transparent !important;
		--${prefixCls}-border-radius-sm: 8px;
		padding-inline: 4px;
		padding-block: 4px;
		display: flex;
		align-items: center;
		justify-content: center;

		> div {
			gap: 4px !important;

		}
	`,
}))

export default function MagicTag({ className, ...props }: TagProps) {
	const { styles, cx } = useStyles()
	return (
		<Tag
			className={cx(styles.tag, className)}
			closeIcon={<MagicIcon component={IconX} size={16} stroke={2} />}
			{...props}
		/>
	)
}
