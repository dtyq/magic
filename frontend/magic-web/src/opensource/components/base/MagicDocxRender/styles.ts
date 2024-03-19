import { createStyles } from "antd-style"

export const useStyles = createStyles(({ token, css, responsive }) => {
	// Base styles
	const baseContainer = css`
		position: relative;
		width: 100%;
		height: 100%;
		background-color: ${token.colorBgContainer};
		overflow: hidden;
		display: flex;
		flex-direction: column;
	`

	// Toolbar styles
	const toolbarStyles = css`
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 8px 16px;
		background-color: ${token.colorBgElevated};
		border-bottom: 1px solid ${token.colorBorder};
		min-height: 48px;
		height: 48px;
		flex-shrink: 0;
		flex-grow: 0;
		box-shadow: 0 2px 4px rgba(0, 0, 0, 0.06);
	`

	// Button styles
	const buttonStyles = css`
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 32px;
		height: 32px;
		border: none;
		background: ${token.colorBgContainer};
		border-radius: ${token.borderRadius}px;
		cursor: pointer;
		transition: all 0.2s ease;
		color: ${token.colorText};
		font-size: 14px;

		&:hover:not(:disabled) {
			background-color: ${token.colorPrimaryBg};
			color: ${token.colorPrimary};
			border-color: ${token.colorPrimary};
			transform: translateY(-1px);
			box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
		}

		&:active:not(:disabled) {
			transform: translateY(0);
			box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
		}

		&:disabled {
			opacity: 0.5;
			cursor: not-allowed;
			background-color: ${token.colorBgContainerDisabled};
		}

		${responsive.mobile} {
			width: 28px;
			height: 28px;
			font-size: 12px;
		}
	`

	// Loading styles
	const loadingContainer = css`
		display: flex;
		align-items: center;
		justify-content: center;
		flex: 1;
		background-color: ${token.colorBgContainer};
		border-radius: ${token.borderRadius}px;
	`

	// Error styles
	const errorContainer = css`
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		flex: 1;
		padding: 24px;
		background-color: ${token.colorErrorBg};
		color: ${token.colorError};
	`

	// Viewer styles
	const viewerStyles = css`
		overflow: auto;
		background: ${token.colorBgLayout};
		position: relative;
		min-height: 0; /* Important for flex child */
		max-width: 100%;
		max-height: 100%;
		width: 100%;
		text-align: center;

		/* Custom scrollbar styling */
		&::-webkit-scrollbar {
			width: 8px;
			height: 8px;
		}

		&::-webkit-scrollbar-track {
			background: ${token.colorBgLayout};
			border-radius: 4px;
		}

		&::-webkit-scrollbar-thumb {
			background: ${token.colorBorderSecondary};
			border-radius: 4px;

			&:hover {
				background: ${token.colorBorder};
			}
		}

		/* Mobile optimizations */
		${responsive.mobile} {
			/* Hide scrollbars on mobile for cleaner look */
			&::-webkit-scrollbar {
				display: none;
			}

			/* Improve touch scrolling */
			-webkit-overflow-scrolling: touch;
			touch-action: manipulation;

			/* Prevent zoom on double tap */
			&,
			& * {
				touch-action: manipulation;
			}
		}
	`

	// Content styles
	const contentStyles = css`
		transition: all 0.3s ease;
		transform-origin: top center;
		min-height: 100%;
		width: fit-content;
		margin: 0 auto;
		display: inline-block;
		text-align: left;

		/* Mobile optimizations */
		${responsive.mobile} {
			/* Remove width restrictions to allow full content display */
			max-width: none;
			width: max-content;

			/* Better touch interaction */
			touch-action: pan-x pan-y;

			/* Prevent text selection issues on mobile */
			-webkit-user-select: text;
			user-select: text;
		}

		.docx-wrapper-wrapper {
			background-color: transparent;
			max-width: none;
			overflow: visible;
		}

		/* Docx content styles */
		.docx-wrapper {
			max-width: none;
			margin: 0 auto;
			font-family: ${token.fontFamily};
			font-size: ${token.fontSize}px;
			line-height: ${token.lineHeight};
			color: ${token.colorText};
			background-color: ${token.colorBgContainer};
			border-radius: ${token.borderRadius}px;
			box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
			min-height: 500px;

			/* Style tables */
			table {
				border-collapse: collapse;
				margin: 16px 0;
				width: 100%;

				td,
				th {
					border: 1px solid ${token.colorBorder};
					padding: 8px 12px;
					text-align: left;
				}

				th {
					background-color: ${token.colorFillQuaternary};
					font-weight: ${token.fontWeightStrong};
				}
			}

			/* Style paragraphs */
			p {
				margin: 8px 0;
				text-align: justify;
				word-wrap: break-word;
			}

			/* Style headings */
			h1,
			h2,
			h3,
			h4,
			h5,
			h6 {
				margin: 16px 0 8px 0;
				font-weight: ${token.fontWeightStrong};
				color: ${token.colorTextHeading};
			}

			/* Style lists */
			ul,
			ol {
				padding-left: 24px;
				margin: 8px 0;
			}

			li {
				margin: 4px 0;
			}

			/* Style images */
			img {
				max-width: 100%;
				height: auto;
				border-radius: ${token.borderRadius}px;
				box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
			}

			/* Style blockquotes */
			blockquote {
				margin: 16px 0;
				padding: 12px 16px;
				background-color: ${token.colorBgLayout};
				border-left: 4px solid ${token.colorPrimary};
				border-radius: ${token.borderRadius}px;
			}
		}
	`

	// Navigation styles
	const navigationStyles = css`
		display: flex;
		align-items: center;
		gap: 8px;

		.ant-input-number {
			border-radius: ${token.borderRadius}px;

			.ant-input-number-input {
				text-align: center;
				padding: 0 8px;
			}
		}
	`

	// Zoom control styles
	const zoomControlStyles = css`
		display: flex;
		align-items: center;
		gap: 8px;

		.ant-input-number {
			border-radius: ${token.borderRadius}px;

			.ant-input-number-input {
				text-align: center;
				padding: 0 8px;
			}
		}
	`

	// Dropdown styles
	const dropdownStyles = css`
		min-width: 200px;

		.ant-dropdown-menu {
			border-radius: ${token.borderRadius}px;
			box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
		}

		.ant-dropdown-menu-item {
			padding: 8px 12px;

			&:hover {
				background-color: ${token.colorBgTextHover};
			}
		}
	`

	// Dropdown item styles
	const dropdownItemStyles = css`
		display: flex;
		align-items: center;
		gap: 8px;
		width: 100%;
		border: none;
		background: transparent;
		cursor: pointer;
		font-size: ${token.fontSize}px;
		color: ${token.colorText};

		.label {
			flex: 1;
			text-align: left;
		}

		.value {
			color: ${token.colorTextSecondary};
			font-size: ${token.fontSize - 2}px;
		}
	`

	// Dark mode styles
	const darkModeStyles = css`
		&.dark-mode {
			.docx-wrapper {
				background-color: ${token.colorBgElevated};
				color: ${token.colorTextBase};

				table {
					td,
					th {
						border-color: ${token.colorBorderSecondary};
					}

					th {
						background-color: ${token.colorBgElevated};
					}
				}

				blockquote {
					background-color: ${token.colorBgElevated};
					border-left-color: ${token.colorPrimary};
				}
			}
		}
	`

	// Responsive styles
	const responsiveStyles = css`
		${responsive.mobile} {
			/* Improve mobile scrolling */
			&::-webkit-scrollbar {
				display: none;
			}

			/* Better touch interaction */
			touch-action: pan-x pan-y;
			-webkit-overflow-scrolling: touch;

			.docx-wrapper {
				padding: 12px;
				font-size: ${token.fontSize - 1}px;
				/* Remove width restrictions to allow full content display */
				max-width: none;
				box-sizing: border-box;
				/* Ensure content can expand as needed */
				width: auto;
			}
		}

		${responsive.tablet} {
			.docx-wrapper {
				padding: 16px;
				max-width: none;
			}
		}

		${responsive.desktop} {
			.docx-wrapper {
				padding: 20px;
			}
		}
	`

	return {
		container: css`
			${baseContainer}
			${darkModeStyles}
			${responsiveStyles}
		`,

		toolbar: toolbarStyles,

		toolbarLeft: css`
			display: flex;
			align-items: center;
			gap: 12px;
		`,

		toolbarRight: css`
			display: flex;
			align-items: center;
			gap: 6px;
		`,

		buttonGroup: css`
			display: flex;
			align-items: center;
			gap: 6px;
		`,

		button: buttonStyles,

		pageInfo: css`
			display: flex;
			align-items: center;
			padding: 4px 8px;
			font-size: ${token.fontSize - 1}px;
			color: ${token.colorTextSecondary};
			background-color: ${token.colorFillQuaternary};
			border-radius: ${token.borderRadius}px;
			border: 1px solid ${token.colorBorder};
		`,

		navigationFull: navigationStyles,

		navigationCompact: css`
			${navigationStyles}
			gap: 4px;
		`,

		sectionInput: css`
			display: flex;
			align-items: center;
			gap: 4px;
		`,

		sectionTotal: css`
			color: ${token.colorTextSecondary};
			font-size: ${token.fontSize - 1}px;
		`,

		zoomControls: zoomControlStyles,

		zoomInput: css`
			display: flex;
			align-items: center;
		`,

		loadingContainer,

		errorContainer,

		viewer: viewerStyles,

		content: contentStyles,

		dropdownMenu: dropdownStyles,

		dropdownItem: dropdownItemStyles,

		dropdownInputItem: css`
			display: flex;
			align-items: center;
			justify-content: space-between;
			padding: 8px 12px;
			gap: 8px;

			.label {
				color: ${token.colorText};
				font-size: ${token.fontSize}px;
			}
		`,

		dropdownSection: css`
			padding: 8px 12px;
		`,

		dropdownTitle: css`
			font-weight: ${token.fontWeightStrong};
			color: ${token.colorTextHeading};
			margin-bottom: 4px;
			font-size: ${token.fontSize - 1}px;
		`,

		dropdownActions: css`
			display: flex;
			flex-direction: column;
			gap: 2px;
		`,

		// Action styles
		retryButton: css`
			margin-top: 12px;
			background-color: ${token.colorPrimary};
			color: ${token.colorWhite};
			border: none;
			padding: 8px 16px;
			border-radius: ${token.borderRadius}px;
			cursor: pointer;
			font-size: ${token.fontSize}px;
			transition: all 0.3s ease;

			&:hover {
				background-color: ${token.colorPrimaryHover};
			}

			&:active {
				background-color: ${token.colorPrimaryActive};
			}
		`,

		// Loading spinner
		loadingSpinner: css`
			font-size: 24px;
			color: ${token.colorPrimary};
		`,

		// Error icon
		errorIcon: css`
			font-size: 48px;
			margin-bottom: 16px;
			color: ${token.colorError};
		`,

		// Error message
		errorMessage: css`
			font-size: ${token.fontSize}px;
			text-align: center;
			margin-bottom: 8px;
			font-weight: ${token.fontWeightStrong};
		`,

		// Error description
		errorDescription: css`
			font-size: ${token.fontSize - 2}px;
			text-align: center;
			color: ${token.colorTextSecondary};
			margin-bottom: 16px;
		`,
	}
})

// Export style utilities
export const getContainerStyles = (height: string, width?: string) => ({
	height,
	width: width || "100%",
	minHeight: "200px",
})
