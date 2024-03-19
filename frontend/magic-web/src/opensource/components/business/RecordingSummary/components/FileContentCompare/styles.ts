import { createStyles } from "antd-style"

/**
 * 文件内容对比组件样式
 */
export const useStyles = createStyles(({ token, css, prefixCls, responsive }) => ({
	// 选择器容器
	selectorContainer: css`
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 12px;
	`,

	// 选择器标签
	selectorLabel: css`
		font-size: 13px;
		color: ${token.colorTextSecondary};
		font-weight: 500;
	`,

	contentSelector: css`
		border-radius: 8px;
		border: 1px solid ${token.colorBorder};

		.${prefixCls}-segmented-item {
			border-radius: 8px;
		}

		.${prefixCls}-segmented-item-selected {
			color: ${token.magicColorUsages.black};
		}
	`,

	// 容器
	container: css`
		display: flex;
		gap: 12px;
		width: 100%;
		min-height: 300px;
		max-height: 60vh;

		${responsive.mobile} {
			max-height: 50vh;
		}
	`,

	// 列容器
	column: css`
		flex: 1;
		display: flex;
		flex-direction: column;
		border: 1px solid ${token.colorBorder};
		border-radius: ${token.borderRadius}px;
		overflow: hidden;
		cursor: pointer;
		transition: all 0.2s;
		background: ${token.magicColorScales.grey[0]};
	`,

	// 选中的列
	columnSelected: css`
		border: 1px solid ${token.colorPrimary};
		box-shadow: 0 0 0 1px ${token.colorPrimary};
	`,

	// 列头部，带进度条效果
	header: css`
		padding: 0;
		background: ${token.colorFillQuaternary};
		border-bottom: 3px solid ${token.colorBorder};
		font-weight: 500;
		font-size: 13px;
		color: ${token.colorText};
		display: flex;
		align-items: center;
		justify-content: space-between;
		position: relative;
		overflow: visible;

		&::after {
			content: "";
			position: absolute;
			bottom: -3px;
			left: 0;
			height: 3px;
			background: ${token.colorPrimary};
			width: var(--progress-width, 0%);
			transition: width 0.3s ease;
		}
	`,

	// 头部标题区域
	headerTitle: css`
		display: flex;
		align-items: center;
		gap: 4px;
	`,

	// 头部操作按钮区域
	headerActions: css`
		display: flex;
		align-items: center;
		gap: 12px;
	`,

	// 内容区域
	content: css`
		flex: 1;
		padding: 0;
		overflow-y: auto;
		overflow-x: hidden;
		font-family: monospace;
		font-size: 12px;
		line-height: 1.6;
		color: ${token.colorText};
		background: ${token.colorBgContainer};
		position: relative;
	`,

	// 内容内层容器
	contentInner: css`
		display: flex;
		min-height: 100%;
	`,

	// 行号区域
	lineNumbers: css`
		flex-shrink: 0;
		width: 50px;
		padding: 12px 8px;
		background: ${token.colorFillQuaternary};
		color: ${token.colorTextSecondary};
		text-align: right;
		user-select: none;
		border-right: 1px solid ${token.colorBorder};
	`,

	// 单个行号
	lineNumberItem: css`
		line-height: 1.6;
		min-height: 19.2px;
		padding: 2px 0;
		margin: 1px 0;
	`,

	// 代码内容区域
	codeContent: css`
		flex: 1;
		padding: 12px;
		white-space: pre-wrap;
		word-wrap: break-word;
	`,

	// 带行号的代码行
	codeLineWithNumber: css`
		display: flex;
	`,

	// 内联行号（用于合并预览）
	inlineLineNumber: css`
		flex-shrink: 0;
		width: 50px;
		padding: 2px 8px 2px 0;
		color: ${token.colorTextSecondary};
		text-align: right;
		user-select: none;
		line-height: 1.6;
		min-height: 19.2px;
		margin-right: 2px;
	`,

	// 内联代码内容
	inlineCodeContent: css`
		flex: 1;
	`,

	// Diff 行基础样式
	diffLine: css`
		padding: 2px 4px;
		margin: 1px 0;
		border-radius: 2px;
		min-height: 19.2px;
		line-height: 1.6;
		border-radius: 4px;
	`,

	// 新增的行
	added: css`
		background: ${token.magicColorUsages.successLight.default};
	`,

	// 删除的行
	deleted: css`
		background: ${token.colorErrorBg};
	`,

	// 未改变的行
	unchanged: css`
		background: transparent;
		min-height: 19.2px;
		line-height: 1.6;
		padding: 2px 4px;
		margin: 1px 0;
	`,

	marker: css`
		font-weight: 600;
		padding: 3px 6px;
		border-radius: 4px 0 0 4px;
		line-height: 16px;
		white-space: nowrap;
		overflow-x: auto;
		display: flex;
		align-items: center;
		justify-content: space-between;
		width: fit-content;
		gap: 2px;
		border: 1px solid ${token.colorBorder};
		border-right: none;
	`,

	conflictMarkerResolved: css`
		background: ${token.magicColorUsages.successLight.default};
		color: ${token.magicColorUsages.success.default};
	`,

	// 冲突标记
	conflictMarker: css`
		background: ${token.magicColorUsages.warningLight.default};
		color: ${token.magicColorUsages.warning.default};
	`,

	conflictSelect: css`
		width: fit-content;
		.${prefixCls}-select-selector.${prefixCls}-select-selector {
			border-radius: 0 4px 4px 0;
		}
	`,

	conflictHeader: css`
		display: flex;
		align-items: center;
		margin-top: 10px;
		margin-bottom: 2px;
		margin-left: 52px;
	`,

	// 版本标签（当前内容/最新内容）
	versionLabel: css`
		font-size: 10px;
		padding: 1px 6px;
		margin-left: 8px;
		font-weight: 500;
		opacity: 0.8;
		white-space: nowrap;
		height: fit-content;
		float: right;
		border-radius: 4px;
	`,

	// 当前版本标签
	currentVersionLabel: css`
		background: ${token.colorErrorBg};
		color: ${token.colorError};
	`,

	// 服务器版本标签
	serverVersionLabel: css`
		background: ${token.magicColorUsages.successLight.default};
		color: ${token.magicColorUsages.success.default};
	`,

	// 空内容提示
	empty: css`
		display: flex;
		align-items: center;
		justify-content: center;
		color: ${token.colorTextTertiary};
		font-size: 12px;
	`,

	// 内联 diff 片段
	inlineFragment: css`
		display: inline;
		padding: 1px 2px;
		border-radius: 2px;
	`,

	// 内联删除片段
	inlineDeleted: css`
		background: ${token.colorErrorBg};
		color: ${token.colorError};
		text-decoration: line-through;
	`,

	// 内联新增片段
	inlineAdded: css`
		background: ${token.magicColorUsages.successLight.default};
		color: ${token.magicColorUsages.success.default};
	`,

	// 内联未改变片段
	inlineUnchanged: css`
		background: transparent;
	`,

	// 已选择标识
	selectedText: css`
		background: ${token.colorPrimaryBg};
		color: ${token.colorPrimary};
		font-weight: 500;
		border-radius: 4px;
		padding: 0 4px;
	`,

	// 冲突操作按钮区域
	conflictActions: css`
		display: flex;
		gap: 8px;
		margin: 8px 0;
		flex-wrap: wrap;
		justify-content: flex-end;
	`,

	// 冲突操作按钮
	conflictActionButton: css`
		font-size: 11px;
		padding: 2px 8px;
		height: auto;
	`,

	// 已解决的冲突
	conflictResolved: css`
		padding: 2px 4px;
		margin: 1px 0;
		border-radius: 4px;
		line-height: 1.6;
		min-height: 19.2px;
		background: ${token.magicColorUsages.successLight.default};
	`,

	// 已解决的删除变更（红色）
	changeResolvedDeletion: css`
		padding: 2px 4px;
		margin: 1px 0;
		border-radius: 4px;
		line-height: 1.6;
		min-height: 19.2px;
		background: ${token.colorErrorBg};
		text-decoration: line-through;
	`,

	// 冲突编辑区域
	conflictEditArea: css`
		margin: 8px 0;
	`,

	// 冲突编辑文本框
	conflictEditTextarea: css`
		font-family: monospace;
		font-size: 12px;
		line-height: 1.6;
		white-space: pre-wrap;
		word-wrap: break-word;
		min-height: 60px;
		resize: vertical;
		width: calc(100% - 52px);
		margin-left: 52px;
		cursor: text;
	`,

	// 冲突编辑操作按钮
	conflictEditActions: css`
		display: flex;
		gap: 8px;
		margin-top: 8px;
	`,

	// 进度信息
	progressInfo: css`
		font-size: 13px;
		color: ${token.colorTextSecondary};
		margin-left: 8px;
	`,

	// 推荐标识 - 规则推荐（蓝色）
	recommendationBadge: css`
		display: inline-flex;
		align-items: center;
		gap: 4px;
		padding: 2px 8px;
		background: #f9f0ff;
		color: ${token.colorPrimary};
		border-radius: 12px;
		font-size: 11px;
		font-weight: 500;
		margin-left: 8px;
	`,

	// 推荐标识 - AI 推荐（紫色）
	recommendationBadgeAI: css`
		display: inline-flex;
		align-items: center;
		gap: 4px;
		padding: 2px 8px;
		background: #f9f0ff;
		color: #722ed1;
		border-radius: 12px;
		font-size: 11px;
		font-weight: 500;
		margin-left: 8px;
	`,

	// 变更标记
	changeMarker: css`
		background: ${token.colorInfoBg};
		color: ${token.colorInfo};
		font-weight: 600;
		padding: 4px 8px;
		margin: 1px 0;
		border-radius: 4px;
		line-height: 1.6;
		white-space: nowrap;
		overflow-x: auto;
	`,

	// 已解决的变更
	changeResolved: css`
		opacity: 0.8;
	`,

	// 已移除的变更
	changeRemoved: css`
		background: ${token.colorBgTextHover};
		color: ${token.colorTextSecondary};
		padding: 8px 12px;
		margin: 4px 0;
		border-radius: 4px;
		font-size: 12px;
		text-align: center;
		font-style: italic;
	`,

	// ChangeSection 组件样式
	changeSection: css`
		background: ${token.colorFillQuaternary};
		padding: 12px;
		margin: 8px 0;
		border-radius: 6px;
		border: 1px solid ${token.colorBorder};
	`,

	changeSectionHeader: css`
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 8px;
	`,

	changeTypeLabel: css`
		font-weight: 600;
		font-size: 12px;
		padding: 2px 8px;
		border-radius: 4px;
	`,

	changeLineRange: css`
		font-size: 11px;
		color: ${token.colorTextTertiary};
	`,

	addition: css`
		background: ${token.magicColorUsages.successLight.default};
		color: ${token.magicColorUsages.success.default};
	`,

	deletion: css`
		background: ${token.colorErrorBg};
		color: ${token.colorError};
	`,

	addedBg: css`
		background: ${token.magicColorUsages.successLight.default};
	`,

	deletedBg: css`
		background: ${token.colorErrorBg};
	`,

	changeContentPreview: css`
		padding: 8px;
		border-radius: 4px;
		font-family: monospace;
		font-size: 12px;
		line-height: 1.6;
		max-height: 200px;
		overflow-y: auto;
	`,

	changePreviewLine: css`
		display: flex;
		gap: 8px;
	`,

	changeLinePrefix: css`
		flex-shrink: 0;
		width: 16px;
		text-align: center;
		font-weight: 600;
	`,

	changeLineText: css`
		flex: 1;
		word-break: break-all;
	`,

	// Change marker for additions
	changeMarkerAddition: css`
		background: ${token.magicColorUsages.successLight.default};
		color: ${token.magicColorUsages.success.default};
		font-weight: 600;
		padding: 4px 8px;
		margin: 1px 0;
		border-radius: 4px;
		line-height: 1.6;
		white-space: nowrap;
		overflow-x: auto;
		display: flex;
		align-items: center;
		justify-content: space-between;
	`,

	// Change marker for deletions
	changeMarkerDeletion: css`
		background: ${token.colorErrorBg};
		color: ${token.colorError};
		font-weight: 600;
		padding: 4px 8px;
		margin: 1px 0;
		border-radius: 4px;
		line-height: 1.6;
		white-space: nowrap;
		overflow-x: auto;
		display: flex;
		align-items: center;
		justify-content: space-between;
	`,
	tooltip: css`
		font-size: 12px;
		line-height: 22px;
	`,
	titleDescription: css`
		color: ${token.magicColorUsages.text[3]};
		font-size: 12px;
		line-height: 16px;
		font-weight: 400;
	`,
}))
