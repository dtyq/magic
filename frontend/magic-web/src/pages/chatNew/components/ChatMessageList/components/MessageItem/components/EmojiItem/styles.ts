import { createStyles } from "antd-style"
import { calculateRelativeSize } from "@/utils/styles"

export const useStyles = createStyles(({ css }, { fontSize }: { fontSize: number }) => {
	return {
		container: css`
			width: fit-content;
			word-break: break-word;
			white-space: pre-wrap;
		`,

		emoji: css`
			width: ${calculateRelativeSize(fontSize, 20)}px;
			height: ${calculateRelativeSize(fontSize, 20)}px;
			margin: 0 2px;
		`,
	}
})
