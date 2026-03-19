import { createStyles } from "antd-style"
import type { MagicMemberAvatarProps } from "./types"

export const useStyles = createStyles(
	({ css }, { nameVisible }: { nameVisible: MagicMemberAvatarProps["showName"] }) => ({
		avatar: css`
			cursor: pointer;
			user-select: none;
		`,
		name: css`
			user-select: none;
			${nameVisible === "vertical"
				? `
					overflow: hidden;
					text-align: center;
					text-overflow: ellipsis;
          line-height: 16px;
          font-size: 12px;
          font-weight: 400;
				`
				: `
					line-height: 20px;
					font-size: 14px;
					font-weight: 400;
				`}
		`,
	}),
)
