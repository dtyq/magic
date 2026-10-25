import { createStyles } from "antd-style"

// 折叠盒只保留第一个块，其余块整块隐藏；真正的行裁剪交给浏览器：
// display:-webkit-box + -webkit-line-clamp 作用在持有行盒的块级元素（p/li/h1…）上，
// 高度由浏览器按真实行盒计算，因此：
// - 内容里出现比文字行更高的内联节点（如 AI 选取元素标签）时，折叠盒自动跟着变高，不会裁掉标签下边框；
// - 调用方不再需要传像素行高，行盒变化（字号、行高、主题）时无需同步常量。
// 行数由 CollapsibleText 通过 --collapsible-lines 下发，细节见下方 collapsed。
export const useStyles = createStyles(() => {
	return {
		container: {
			width: "100%",
		},

		textContainer: {
			position: "relative",
			overflow: "hidden",

			// 基础文本样式
			fontSize: "12px",
			lineHeight: "16px",
			wordBreak: "break-word",
			cursor: "default",
		},

		collapsed: {
			display: "block",
			overflow: "hidden",
			position: "relative",

			// 摘要只展示首个块：后续块整体隐藏；列表再额外只保留第一项。
			"& .ProseMirror > *:not(:first-child)": {
				display: "none",
			},
			"& .ProseMirror > :is(ul, ol):first-child > li:not(:first-child)": {
				display: "none",
			},

			// 行裁剪：-webkit-line-clamp 只有在元素自己产生行盒（IFC）时才生效，
			// 因此必须落在 p/li/h1… 这类块级文本容器上，落在折叠盒或 .ProseMirror 上都不会生效。
			// 当前 RichText schema 的块级节点只有段落，其余标签用于将来新增块类型时不至于漏折叠。
			// 这里的 overflow:hidden 同时是 SmartTooltip 判断「是否被折叠、要不要弹全文」的溢出信号，
			// 去掉它提示会静默失效。
			"& .ProseMirror :is(p, li, h1, h2, h3, h4, h5, h6, pre)": {
				display: "-webkit-box",
				WebkitBoxOrient: "vertical",
				WebkitLineClamp: "var(--collapsible-lines, 2)",
				overflow: "hidden",
			},

			// 裁剪边界就是行盒下沿，行内节点若用相对定位把可视盒推出自己所在的行盒，
			// 探出去的那部分正好落在边界外被裁掉。AI 选取元素标签用 top-1px 做基线微调
			// （高 20px 的标签落在 16px 行盒里），多出来的 1px 就是被吃掉的下边框。
			// 折叠预览里把这类位移归零，可视盒与行盒重合：边框完整，也不会漏出下一行。
			"& .magic-mention, & [data-magic-editor-node]": {
				top: "0 !important",
			},

			// 渐变遮罩效果，让文本在末尾逐渐消失
			"&::after": {
				content: '""',
				position: "absolute",
				right: 0,
				bottom: 0,
				width: "60px",
				height: "16px",
				pointerEvents: "none",
			},
		},

		tooltipContent: {
			color: "inherit",
			"& p": {
				margin: 0,
				fontSize: "inherit !important",
				lineHeight: "inherit !important",
				color: "inherit !important",
			},
			"& .magic-mention, & .super-placeholder": {
				fontSize: "inherit !important",
				lineHeight: "inherit !important",
				color: "inherit !important",
			},
			"& .inspector-detail-read-only, & .inspector-detail-read-only *": {
				color: "inherit !important",
			},
			"& .inspector-detail-read-only > button": {
				height: "16px",
				padding: 0,
				border: 0,
				lineHeight: "16px",
			},
			"& .inspector-detail-read-only.magic-mention": {
				borderColor: "rgb(255 255 255 / 0.3)",
				backgroundColor: "rgb(255 255 255 / 0.12) !important",
			},
			"& .inspector-detail-node-view > span": {
				borderColor: "rgb(255 255 255 / 0.3)",
				backgroundColor: "rgb(255 255 255 / 0.12)",
			},
			"& .inspector-detail-node-view [class*='bg-muted']": {
				backgroundColor: "rgb(255 255 255 / 0.12)",
			},
		},
	}
})
