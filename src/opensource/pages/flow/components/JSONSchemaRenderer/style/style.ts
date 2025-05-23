import { createStyles } from "antd-style"

export const useStyles = createStyles(({ css }) => ({
	jsonSchemaTree: css`
		overflow: auto;
		max-height: 200px;

		&::-webkit-scrollbar {
			width: 6px;
			height: 6px;
			background-color: inherit;
		}

		&::-webkit-scrollbar-track {
			width: 4px;
			background-color: inherit;
		}

		&::-webkit-scrollbar-thumb {
			background-color: #2e2f3817;
			border-radius: 8px;
			transition: all linear 0.1s;
		}
	`,

	keyItem: css`
		min-height: 32px;
		position: relative;
		list-style: none;
		outline: 2px solid transparent;
		border-radius: 8px;
		display: flex;
		align-items: center;
		cursor: pointer;

		&:not(.hover-none) {
			&:hover {
				background-color: #2e2f380d;
			}
		}

		svg {
			margin-top: 2px;
			height: 10px;
			width: 10px;
		}
	`,

	dropdown: css`
		color: #1c1d2399;
		margin-left: 6px;
		padding-right: 0;
		height: 16px !important;
		width: 16px !important;
	`,

	title: css`
		margin-left: 10px;
		color: #1c1d23cc;
		font-weight: 600;
		line-height: 20px;
	`,

	key: css`
		color: #1c1d2399;
		font-size: 12px;
		line-height: 16px;
		margin-left: 6px;
	`,

	type: css`
		background-color: #2e2f3817;
		border-radius: 3px;
		padding: 2px 8px;
		color: #1c1d2399;
		font-size: 12px;
		line-height: 16px;
		margin-left: 6px;
	`,

	desc: css`
		margin-left: 6px;
	`,

	objectRow: css`
		position: relative;
		width: 100%;

		&::before {
			position: absolute;
			top: 32px;
			left: 32px;
			display: block;
			border-left: 1.3px dashed #1c1d2399;
			height: calc(100% - 36px);
			content: "";
			z-index: 1;
		}
	`,

	line: css`
		position: absolute;
		top: 32px;
		left: 32px;
		display: block;
		border-left: 1.3px dashed #1c1d2399;
	`,

	rootKey: css`
		.item {
			margin-left: 8px;
		}
	`,

	objectKeyItem: css`
		.item {
			margin-left: 8px;
		}
	`,

	keyList: css`
		list-style-type: none;
		margin-bottom: 0;

		.keyItem {
			position: relative;
			list-style: none;

			&.hover-none {
				outline: none;
			}
		}
	`,
}))
