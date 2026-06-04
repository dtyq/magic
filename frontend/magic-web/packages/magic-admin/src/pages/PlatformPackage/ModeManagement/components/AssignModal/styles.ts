import { createStyles } from "antd-style"

export const useStyles = createStyles(({ prefixCls, css, token, isDarkMode }) => {
	return {
		modalBody: css`
			--${prefixCls}-modal-body-padding: 0 !important;
			display: flex;
			height: 80vh;
			overflow-y: auto;
			scrollbar-width: none;
		`,
		content: css`
			width: 60%;
			padding: 20px 20px 0;
			&:first-child {
				border-right: 1px solid ${token.magicColorUsages.border};
			}
		`,
		title: css`
			font-size: 16px;
			font-weight: 600;
			color: ${token.magicColorUsages.text[1]};
		`,
		nameWrapper: css`
			overflow: hidden;
		`,
		name: css`
			text-overflow: ellipsis;
			overflow: hidden;
			white-space: nowrap;
		`,
		opacity: css`
			opacity: 0.5;
		`,
		desc: css`
			font-size: 12px;
			color: ${token.magicColorUsages.text[3]};
			text-overflow: ellipsis;
			overflow: hidden;
			white-space: nowrap;
		`,
		saveTips: css`
			font-size: 14px;
			color: ${token.magicColorUsages.text[3]};
		`,
		group: css`
			width: 100%;
			padding: 10px;
			background-color: ${token.magicColorScales.grey[0]};
			border: 1px solid ${token.magicColorUsages.border};
			border-radius: 8px;
			transition: all 0.2s ease;
		`,
		groupDragOver: css`
			border-color: ${token.magicColorUsages.primary.default};
			background-color: ${isDarkMode
				? token.magicColorUsages.primaryLight.default
				: token.magicColorScales.brand[0]};
			box-shadow: 0 0 0 1px ${token.magicColorUsages.primaryLight.hover};
		`,
		groupSortHover: css`
			border-color: ${token.magicColorUsages.warning.default};
			background-color: ${isDarkMode
				? token.magicColorUsages.warningLight.default
				: token.magicColorScales.yellow[0]};
		`,
		insertHint: css`
			position: absolute;
			top: 50%;
			left: 50%;
			transform: translate(-50%, -50%);
			z-index: 10;
			padding: 6px 12px;
			background-color: ${token.magicColorUsages.warning.default};
			border-radius: 6px;
			box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
			pointer-events: none;
			animation: fadeInScale 200ms ease-out;

			@keyframes fadeInScale {
				0% {
					opacity: 0;
					transform: translate(-50%, -50%) scale(0.9);
				}
				100% {
					opacity: 1;
					transform: translate(-50%, -50%) scale(1);
				}
			}
		`,
		insertHintText: css`
			font-size: 13px;
			font-weight: 500;
			color: ${token.magicColorUsages.bg[0]};
			white-space: nowrap;
		`,
		groupList: css`
			height: 100%;
			overflow-y: auto;
			scrollbar-width: none;
			padding-bottom: 20px;
		`,
		groupHeader: css`
			color: ${token.magicColorUsages.text[2]};
			font-size: 14px;
			font-weight: 600;
		`,
		item: css`
			width: 100%;
			height: 44px;
			border: 1px solid ${token.magicColorUsages.border};
			border-radius: 8px;
			padding: 10px;
			color: ${token.magicColorUsages.text[1]};
			background-color: ${token.magicColorUsages.bg[0]};
		`,
		disabledItem: css`
			border: 1px dashed ${token.magicColorUsages.warning.default};
			background-color: ${token.magicColorUsages.warningLight.default};
		`,
		deletedItem: css`
			border: 1px dashed ${token.magicColorUsages.danger.default};
			background-color: ${token.magicColorUsages.dangerLight.default};
		`,
		disabledText: css`
			color: ${token.magicColorUsages.warning.default};
		`,
		deletedText: css`
			color: ${token.magicColorUsages.danger.default};
		`,
		draggingItem: css`
			opacity: 0.5;
			z-index: 0;
			&:focus {
				box-shadow:
					0 0 0 calc(1px / var(--scale-x, 1)) rgba(63, 63, 68, 0.05),
					0 1px calc(3px / var(--scale-x, 1)) 0 rgba(34, 33, 81, 0.15);
			}
		`,
		dragOverlay: css`
			scale: 1.05;
			z-index: 9999;
			animation: pop 200ms cubic-bezier(0.18, 0.67, 0.6, 1.22);
		`,
		fadeIn: css`
			@keyframes fadeIn {
				0% {
					opacity: 0;
				}
				100% {
					opacity: 1;
				}
			}

			animation: fadeIn 500ms ease;
		`,
		resetBtn: css`
			background-color: ${token.magicColorUsages.dangerLight.default} !important;
			border: none;
		`,
		link: css`
			font-size: 12px;
			color: ${token.magicColorUsages.primary.default};
			font-weight: 400;
			cursor: pointer;
		`,
		dangerLink: css`
			color: ${token.magicColorUsages.danger.default};
		`,
		gripIcon: css`
			color: ${token.magicColorUsages.text[2]};
		`,
		dropZoneBg: css`
			height: 44px;
			border-radius: 8px;
			border: 1px dashed
				${isDarkMode
					? token.magicColorUsages.primaryLight.hover
					: token.magicColorScales.brand[1]};
			background-color: ${isDarkMode
				? token.magicColorUsages.primaryLight.default
				: token.magicColorScales.brand[0]};
		`,
		spin: css`
			height: 100%;
			overflow: hidden;
		`,
		skeletonWrapper: css`
			width: 100%;
			height: 100%;
		`,
		dynamicModelItem: css`
			min-height: 44px;
			height: auto;
			background-color: ${token.magicColorUsages.bg[0]};
			position: relative;
		`,
		select: css`
			width: 100px;
			margin-right: 10px;
			height: 24px;
			.${prefixCls}-select-selector {
				border-radius: 8px;
			}
		`,
		downgrade: css`
			font-size: 14px;
			color: ${token.magicColorUsages.text[1]};
			font-weight: 600;
			margin-bottom: 4px;
		`,
		actionWrapper: css`
			height: 24px;
		`,
	}
})
