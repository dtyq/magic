import { createStyles } from "antd-style"

export const useFileTypeIconStyles = createStyles(({ css, token }) => ({
	wrapper: css`
		position: relative;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
		border-radius: 3px;
		font-weight: 500;
		font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
		text-transform: uppercase;
		font-size: 50%;
		line-height: 1;
		user-select: none;
		overflow: hidden;
	`,
	colorVariant: css`
		color: white;
		text-shadow: 0 0 2px rgba(0, 0, 0, 0.3);
	`,
	monoVariant: css`
		background-color: rgba(0, 0, 0, 0.04);
		border: 1px solid rgba(0, 0, 0, 0.1);
	`,
	customIcon: css`
		width: 100%;
		height: 100%;
		display: inline-flex;
		align-items: center;
		justify-content: center;
	`,
}))
