import { Input } from "antd"
import { createStyles } from "antd-style"
import type { SearchProps } from "antd/es/input"
import { IconSearch } from "@tabler/icons-react"

import { colorUsages } from "@/opensource/providers/ThemeProvider/colors"
import MagicIcon from "../MagicIcon"

interface MagicSearchInputProps extends SearchProps {}

const useStyles = createStyles(({ token, css, prefixCls }) => ({
	search: css`
		border-radius: 8px;
		border: 1px solid ${token.colorBorderSecondary};
		background-color: ${token.magicColorScales.grey[0]};
		overflow: hidden;

		.${prefixCls}-input-group-addon {
			background-color: transparent;
			border: none;
		}
		.${prefixCls}-input-search-button {
			display: none;
		}
		.magic-input-group-wrapper {
			border-radius: 8px;
		}
		.${prefixCls}-input {
			border: none;
			padding-left: 0;
			background-color: transparent;
			&:focus {
				border: none;
				box-shadow: none;
			}
		}
	`,
}))

const iconSizeMap = {
	small: 14,
	middle: 16,
	large: 18,
}

function MagicSearchInput({ ...rest }: MagicSearchInputProps) {
	const { styles } = useStyles()

	return (
		<Input.Search
			size="large"
			addonBefore={
				<MagicIcon
					color={colorUsages.text[3]}
					stroke={2}
					component={IconSearch}
					size={iconSizeMap[rest.size ?? "middle"]}
				/>
			}
			className={styles.search}
			{...rest}
		/>
	)
}

export default MagicSearchInput
