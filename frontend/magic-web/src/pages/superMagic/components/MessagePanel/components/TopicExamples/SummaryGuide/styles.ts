import { createStyles } from "antd-style"

export const useStyles = createStyles(({ css }) => {
	return {
		guideOverlay: css`
			position: fixed;
			top: 0;
			left: 0;
			right: 0;
			bottom: 0;
			z-index: 1000;
			pointer-events: auto;
		`,

		guideMask: css`
			position: absolute;
			top: 0;
			left: 0;
			width: 100%;
			height: 100%;
			pointer-events: none;
		`,

		guideHighlight: css`
			position: absolute;
			border-radius: 8px;
			background: transparent;
			box-shadow: 0 0 0 4px rgba(255, 255, 255, 0.2);
			pointer-events: none;
		`,

		guideHighlightText: css`
			position: absolute;
			border-radius: 8px;
			overflow: hidden;
			pointer-events: none;
			z-index: 1000;
		`,

		guidePopoverContainer: css`
			position: absolute;
			display: flex;
			flex-direction: column;
			align-items: center;
			gap: 8px;
			z-index: 1001;
		`,

		guideCursor: css`
			width: 42px;
			height: 42px;
			flex-shrink: 0;
		`,

		guidePopover: css`
			background: #ffffff;
			border: 4px solid #000000;
			border-radius: 16px;
			padding: 20px;
			display: flex;
			flex-direction: column;
			gap: 12px;
			box-shadow:
				0px 1px 3px 0px rgba(0, 0, 0, 0.1),
				0px 1px 2px -1px rgba(0, 0, 0, 0.1);
		`,

		guidePopoverContent: css`
			display: flex;
			flex-direction: column;
			gap: 6px;
			width: 100%;
		`,

		guidePopoverTitleRow: css`
			width: 100%;
			height: 36px;
			display: flex;
			align-items: center;
			justify-content: center;
			gap: 4px;
			background: #f1f5f9;
			border-radius: 6px;
			font-size: 14px;
			color: #0a0a0a;
		`,

		guidePopoverDescription: css`
			font-size: 14px;
			font-weight: 400;
			color: #0a0a0a;
			text-align: center;
		`,

		guidePopoverButtonGroup: css`
			display: flex;
			align-items: flex-start;
			justify-content: center;
			gap: 8px;
			width: 100%;
		`,

		guidePopoverButton: css`
			display: flex;
			align-items: center;
			justify-content: center;
			height: 36px;
			padding: 8px 16px;
			border-radius: 8px;
			font-size: 14px;
			cursor: pointer;
			transition: all 0.2s ease;

			&:focus {
				outline: none;
			}
		`,

		guidePopoverButtonText: css`
			background: transparent;
			border: none;
			color: #0a0a0a;

			&:hover {
				background: #f5f5f5;
			}
		`,

		guidePopoverButtonOutline: css`
			flex: 1;
			background: #ffffff;
			border: 1px solid #e5e5e5;
			color: #0a0a0a;
			font-weight: 500;
			box-shadow: 0px 1px 2px 0px rgba(0, 0, 0, 0.05);

			&:hover {
				background: #f9fafb;
			}
		`,

		guidePopoverButtonFull: css`
			flex: 1;
		`,

		startRecordingButton: css`
			display: flex;
			align-items: center;
			justify-content: center;
			height: 24px;
			padding: 0px 8px;
			font-size: 12px;
			line-height: 16px;
			font-weight: 500;
			color: #fafafa;
			border-radius: 1000px;
			background: linear-gradient(53.79deg, #443855 0%, #000000 100%);
			border: 1px solid #e5e5e5;
			box-shadow: 0px 1px 2px 0px rgba(0, 0, 0, 0.05);
		`,
		selectProjectButton: css`
			display: flex;
			align-items: center;
			justify-content: center;
			height: 24px;
			padding: 0px 8px;
			font-size: 12px;
			line-height: 16px;
			font-weight: 500;
			color: #0a0a0a;
			border: 1px solid #e5e5e5;
			background: #ffffff;
			box-shadow: 0px 1px 2px 0px rgba(0, 0, 0, 0.05);
		`,
		primaryButton: css`
			display: flex;
			align-items: center;
			gap: 4px;
			font-size: 14px;
			line-height: 20px;
			color: #0a0a0a;
		`,
		primaryButtonIcon: css`
			width: 24px;
			height: 24px;
			display: flex;
			align-items: center;
			justify-content: center;
			color: #171717;
			background: #fff;
			border-radius: 6px;
			border: 1px solid #e5e5e5;
			box-shadow: 0px 1px 2px 0px rgba(0, 0, 0, 0.05);
		`,

		editorHighlightContent: css`
			width: 100%;
			height: 100%;
			padding: 4px 8px;
			background: #ffffff;
			color: #0a0a0a;
			font-size: 14px;
			font-weight: 400;
		`,
	}
})
