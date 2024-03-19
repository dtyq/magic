import { IconChevronRight } from "@tabler/icons-react"
import { Collapse, type CollapseProps } from "antd"
import { createStyles } from "antd-style"
import MagicIcon from "../MagicIcon"

const useStyles = createStyles(({ css, prefixCls, token }) => {
	return {
		container: css`
			--${prefixCls}-collapse-content-bg: ${token.colorBgContainer} !important;
			
			.${prefixCls}-collapse-item {
				transition: all 0.35s cubic-bezier(0.215, 0.61, 0.355, 1);
			}
			
			.${prefixCls}-collapse-header {
				transition: all 0.35s cubic-bezier(0.215, 0.61, 0.355, 1) !important;
			}
			
			.${prefixCls}-collapse-content {
				transition: all 0.35s cubic-bezier(0.215, 0.61, 0.355, 1) !important;
			}
		`,
		noAnimation: css`
			.${prefixCls}-collapse-item,
				.${prefixCls}-collapse-header,
				.${prefixCls}-collapse-content {
				transition: none !important;
			}
		`,
	}
})

export interface MagicCollapseProps extends CollapseProps {
	disableAnimation?: boolean
}

function MagicCollapse({ className, disableAnimation, ...props }: MagicCollapseProps) {
	const { styles, cx } = useStyles()

	return (
		<Collapse
			ghost
			className={cx(styles.container, disableAnimation && styles.noAnimation, className)}
			bordered={false}
			expandIconPosition="end"
			expandIcon={({ isActive }) => (
				<MagicIcon
					component={IconChevronRight}
					size={24}
					style={{
						transform: `rotate(${isActive ? 90 : 0}deg)`,
						transition: disableAnimation
							? "none"
							: "transform 0.35s cubic-bezier(0.215, 0.61, 0.355, 1)",
					}}
				/>
			)}
			{...props}
		/>
	)
}

export default MagicCollapse
