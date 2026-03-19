import { Skeleton as AntdSkeleton } from "antd-mobile"
import type { SkeletonTitleProps, SkeletonProps } from "antd-mobile/es/components/skeleton"
import type { FC } from "react"

/**
 * 自定义 Skeleton.Title 组件
 * 自动添加 marginTop: 0, marginBottom: 0
 */
const SkeletonTitle: FC<SkeletonTitleProps> = (props) => {
	const { style, ...restProps } = props
	return (
		<AntdSkeleton.Title
			{...restProps}
			style={{
				marginTop: 0,
				marginBottom: 0,
				...style,
			}}
		/>
	)
}

/**
 * 自定义 Skeleton.Paragraph 组件
 * 自动添加 marginTop: 0, marginBottom: 0
 */
const SkeletonParagraph: FC<SkeletonProps & { lineCount?: number }> = (props) => {
	const { style, ...restProps } = props
	return (
		<AntdSkeleton.Paragraph
			{...restProps}
			style={{
				marginTop: 0,
				marginBottom: 0,
				...style,
			}}
		/>
	)
}

/**
 * 导出增强版的 Skeleton 组件
 * 所有 Title 和 Paragraph 默认移除上下 margin
 */
export const Skeleton = {
	Title: SkeletonTitle,
	Paragraph: SkeletonParagraph,
}
