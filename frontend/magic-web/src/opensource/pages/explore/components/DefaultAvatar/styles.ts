import { createStyles } from "antd-style"

interface StylesProps {
	size: number
}

export const useStyles = createStyles(({ css }, { size }: StylesProps) => {
	return {
		defaultAvatar: css`
			width: ${size}px;
			height: ${size}px;
			border-radius: 8px;
			object-fit: cover;
			flex-shrink: 0;
		`,
	}
})
