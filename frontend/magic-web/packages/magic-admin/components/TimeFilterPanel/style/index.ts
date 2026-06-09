import { createStyles } from "antd-style"

export const useStyles = createStyles(({ css, token, prefixCls }) => ({
	triggerButton: css`
		width: 100%;
		padding: 8px 12px;
		border-radius: 8px;
		border: 1px solid ${token.magicColorUsages.border};
		background: ${token.magicColorUsages.bg[0]};
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 10px;
		color: ${token.magicColorUsages.text[1]};

		&:hover {
			border-color: ${token.magicColorScales.brand[3]};
			background: #f8fbff;
		}

		&:hover [data-role="time-filter-clear"] {
			opacity: 1;
			visibility: visible;
			pointer-events: auto;
		}

		&:hover [data-role="time-filter-icon"] {
			opacity: 0;
			visibility: hidden;
		}
	`,
	triggerContent: css`
		display: flex;
		align-items: center;
		gap: 10px;
		min-width: 0;
		flex: 1;
	`,
	triggerIconWrap: css`
		position: relative;
	`,
	triggerTextBlock: css`
		min-width: 0;
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		font-size: 14px;
		font-weight: 600;
		color: ${token.magicColorUsages.text[1]};
		gap: 2px;
	`,
	triggerMeta: css`
		font-size: 11px;
		line-height: 1.2;
		color: ${token.magicColorUsages.text[3]};
	`,
	triggerLabel: css`
		max-width: 100%;
		font-size: 14px;
		font-weight: 600;
		color: ${token.magicColorUsages.text[1]};
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	`,
	triggerPrefix: css`
		flex-shrink: 0;
		font-size: 14px;
		font-weight: 600;
		color: ${token.magicColorUsages.text[3]};
		margin-inline-end: 8px;
	`,
	triggerPlaceholder: css`
		font-size: 14px;
		color: ${token.magicColorUsages.text[3]};
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	`,
	triggerClearIconWrap: css`
		position: absolute;
		top: 50%;
		left: 70%;
		transform: translate(-50%, -50%);
		width: 16px;
		height: 16px;
		background: ${token.magicColorUsages.fill[0]};
		border-radius: 999px;
		display: flex;
		align-items: center;
		justify-content: center;
		cursor: pointer;
		opacity: 0;
		visibility: hidden;
		pointer-events: none;
		transition: opacity 0.16s ease;
		&:hover {
			background: ${token.magicColorUsages.fill[1]};
		}
	`,
	triggerClearButton: css`
		color: ${token.magicColorUsages.text[3]};
		&:hover {
			color: ${token.magicColorUsages.text[1]};
		}
	`,
	triggerCalendarIcon: css`
		opacity: 1;
		visibility: visible;
		transition: opacity 0.16s ease;
	`,
	popover: css`
		.${prefixCls}-popover-inner {
			padding: 0;
			border-radius: 14px;
			overflow: hidden;
			box-shadow: 0 16px 40px rgba(15, 23, 42, 0.14);
		}
	`,
	panel: css`
		width: 680px;
		max-width: min(680px, calc(100vw - 32px));
		padding: 0;
		background: ${token.magicColorUsages.bg[0]};
	`,
	tabs: css`
		.${prefixCls}-tabs-content-holder {
			padding: 12px;
		}
	`,
	tabPane: css`
		display: flex;
		flex-direction: column;
		gap: 8px;
	`,
	topBar: css`
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
	`,
	rangeInline: css`
		min-width: 0;
		flex: 1;
		padding: 0 2px;
	`,
	currentRangeLabel: css`
		font-size: 11px;
		font-weight: 600;
		letter-spacing: 0.04em;
		color: ${token.magicColorUsages.text[3]};
		text-transform: uppercase;
	`,
	currentRangeValue: css`
		font-size: 13px;
		line-height: 1.5;
		color: ${token.magicColorUsages.text[2]};
		word-break: break-word;
	`,
	switchCard: css`
		flex-shrink: 0;
		display: flex;
		align-items: center;
		gap: 10px;
		padding: 4px 0 4px 12px;
	`,
	switchLabel: css`
		font-size: 12px;
		font-weight: 500;
		color: ${token.magicColorUsages.text[3]};
	`,
	relativeLayout: css`
		display: grid;
		grid-template-columns: minmax(0, 1.3fr) minmax(220px, 0.9fr);
		gap: 18px;
	`,
	relativeMain: css`
		display: flex;
		flex-direction: column;
		gap: 14px;
		padding-right: 18px;
		border-right: 1px solid ${token.magicColorScales.grey[2]};
	`,
	relativeSide: css`
		display: flex;
		flex-direction: column;
		gap: 16px;
	`,
	section: css`
		display: flex;
		flex-direction: column;
		gap: 10px;
	`,
	sectionLabel: css`
		font-size: 12px;
		font-weight: 600;
		color: ${token.magicColorUsages.text[3]};
	`,
	optionGrid: css`
		display: grid;
		grid-template-columns: repeat(4, minmax(0, 1fr));
		gap: 4px 8px;
	`,
	quickPresetColumns: css`
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		gap: 12px;
	`,
	quickPresetColumn: css`
		display: flex;
		flex-direction: column;
		gap: 4px;
		min-width: 0;
	`,
	sideOptionGrid: css`
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 4px 8px;
	`,
	standardPresetGrid: css`
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 4px 8px;
	`,
	monthlyGrid: css`
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 4px 8px;
	`,
	optionButton: css`
		justify-content: flex-start;
		padding: 2px 8px;
		height: 30px;
		border-radius: 8px;
		font-size: 13px;
		font-weight: 500;
		color: ${token.magicColorUsages.text[1]};

		&:hover {
			background: #f3f6fb;
			color: ${token.magicColorScales.brand[5]};
		}
	`,
	optionButtonActive: css`
		background: #e8f1ff;
		color: ${token.magicColorScales.brand[6]};
		font-weight: 600;
	`,
	customButton: css`
		width: fit-content;
		padding: 3px 12px;
		height: 30px;
		border-radius: 8px;
		font-size: 13px;
		font-weight: 600;
		color: ${token.magicColorScales.brand[6]};
		background: #eef4ff;
	`,
	customButtonActive: css`
		background: #d9e8ff;
	`,
	customTray: css`
		display: grid;
		grid-template-columns: auto minmax(72px, 88px) minmax(92px, 108px) auto;
		align-items: center;
		gap: 10px;
		padding: 10px 12px;
		border-radius: 12px;
		background: #f5f7fb;
		border: 1px solid ${token.magicColorScales.grey[2]};
		max-width: 100%;
	`,
	customTrayActive: css`
		border-color: #c7dbff;
		background: #f1f6ff;
	`,
	customPrefix: css`
		font-size: 13px;
		font-weight: 500;
		color: ${token.magicColorUsages.text[2]};
	`,
	customInput: css`
		width: 100%;
	`,
	customSelect: css`
		width: 100%;
	`,
	absolutePickerEmbed: css`
		position: relative;
		width: 100%;
		min-height: 360px;
		overflow-x: auto;
	`,
	absoluteRangePicker: css`
		width: 100%;

		.${prefixCls}-picker {
			position: absolute;
			width: 1px;
			height: 1px;
			padding: 0;
			margin: -1px;
			overflow: hidden;
			clip: rect(0, 0, 0, 0);
			white-space: nowrap;
			border: 0;
		}
	`,
	absolutePickerDropdown: css`
		&& {
			position: static !important;
			inset: auto !important;
			top: auto !important;
			left: auto !important;
			transform: none !important;
			padding: 10px 0 0 0;
			--${prefixCls}-date-picker-presets-width: 80px;
		}

		.${prefixCls}-picker-range-arrow {
			display: none !important;
		}

		.${prefixCls}-picker-panel-container {
			box-shadow: none;
		}
	`,
	confirmButton: css`
		min-width: 92px;
	`,
	footer: css`
		display: flex;
		justify-content: flex-end;
		gap: 8px;
	`,
	historyList: css`
		display: flex;
		flex-direction: column;
		gap: 10px;
		max-height: 360px;
		overflow: auto;
		scrollbar-width: none;
	`,
	historyItem: css`
		width: 100%;
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: 8px;
		padding: 12px;
		border-radius: 12px;
		border: 1px solid ${token.magicColorUsages.border};
		background: ${token.magicColorUsages.bg[0]};
		text-align: left;
		cursor: pointer;
		transition:
			border-color 0.2s ease,
			box-shadow 0.2s ease;

		&:hover {
			border-color: ${token.magicColorScales.brand[3]};
			box-shadow: 0 12px 24px rgba(37, 99, 235, 0.08);
		}
	`,
	historyItemMain: css`
		display: flex;
		flex-direction: column;
		gap: 4px;
		min-width: 0;
	`,
	historyTitle: css`
		font-size: 13px;
		font-weight: 600;
		color: ${token.magicColorUsages.text[1]};
	`,
	historyRange: css`
		font-size: 12px;
		color: ${token.magicColorUsages.text[3]};
		word-break: break-word;
	`,
	historyMeta: css`
		font-size: 12px;
		color: ${token.magicColorUsages.text[3]};
	`,
	empty: css`
		padding: 24px 12px;
		text-align: center;
		color: ${token.magicColorUsages.text[3]};
		font-size: 13px;
	`,
}))
