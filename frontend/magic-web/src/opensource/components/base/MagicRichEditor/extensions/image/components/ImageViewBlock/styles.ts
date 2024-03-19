import { createStyles } from "antd-style"

export const useStyles = createStyles(({ css, token }) => ({
	wrapper: css`
		position: relative;
		text-align: center;
		line-height: 0;
		display: inline-block;
		padding: 4px 2px 0 2px;
	`,
	imageContainer: css`
		position: relative;
		margin-left: auto;
		margin-right: auto;
		border-radius: 0.375rem;
		object-fit: contain;
	`,
	innerContainer: css`
		position: relative;
		display: flex;
		height: 100%;
		cursor: default;
		flex-direction: column;
		align-items: center;
		gap: 0.5rem;
		border-radius: 0.25rem;
	`,
	selected: css`
		outline: 1px solid ${token.colorPrimary};
		outline-offset: 1px;
	`,
	imageWrapper: css`
		height: 100%;
		contain: paint;
		position: relative;
	`,
	imageInnerWrapper: css`
		position: relative;
		height: 100%;
	`,
	loadingContainer: css`
		position: absolute;
		inset: 0;
	`,
	spinner: css`
		width: 1.75rem;
		height: 1.75rem;
	`,
	image: css`
		height: auto;
		border-radius: 0.25rem;
		object-fit: contain;
		transition: box-shadow 0.2s;
		max-width: 180px;
		max-height: 180px;
	`,
	hiddenImage: css`
		opacity: 0;
	`,
	resizeHandleLeft: css`
		left: 0.25rem;
	`,
	resizeHandleRight: css`
		right: 0.25rem;
	`,
	hidden: css`
		opacity: 0;
	`,
}))
