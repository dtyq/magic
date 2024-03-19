import MagicLoading from "@/opensource/components/other/MagicLoading"
import { createStyles } from "antd-style"
import { useMemo } from "react"

export const sizeMap = {
	small: 30,
	default: 50,
	large: 70,
}

export const useStyles = createStyles(({ css, prefixCls }, { size }: { size: number }) => {
	return {
		wrapper: css`
			width: 100%;
			// .${prefixCls}-spin-blur.${prefixCls}-spin-blur {
			// 	opacity: 0;
			// }
			display: flex;
			justify-content: center;
			align-items: center;

			.${prefixCls}-spin-container {
				width: 100%;
				height: 100%;
			}
		`,
		icon: css`
			--${prefixCls}-spin-content-height: unset !important;

			.${prefixCls}-spin-dot {
				width: ${size}px;
				height: ${size}px;
				--magic-spin-dot-size: ${size}px;
			}

			&.${prefixCls}-spin-show-text > .${prefixCls}-spin-dot {
				transform: translateY(-50%);
			}
		`,
	}
})

export function useMagicSpinProps(section: boolean = true, size?: "small" | "default" | "large") {
	const { styles } = useStyles({ size: sizeMap[size ?? "default"] })

	return useMemo(
		() => ({
			indicator: <MagicLoading section={section} />,
			rootClassName: styles.icon,
			wrapperClassName: styles.wrapper,
		}),
		[section, styles.icon, styles.wrapper],
	)
}
