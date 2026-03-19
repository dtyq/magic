import { createStyles } from "antd-style"
import { calculateRelativeSize } from "@/utils/styles"

export default createStyles(({ css }, { fontSize = 14 }: { fontSize?: number }) => ({
	text: css`
		width: fit-content;
		border-radius: 12px;
		text-align: justify;
		font-size: ${fontSize}px;
		font-weight: 400;
		line-height: ${calculateRelativeSize(20, fontSize)}px;
		max-width: var(--message-max-width);
		overflow: hidden;
	`,
}))
