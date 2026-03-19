import { Skeleton, SkeletonProps } from "antd"
import { AvatarProps } from "antd/es/skeleton/Avatar"
import { SkeletonButtonProps } from "antd/es/skeleton/Button"
import { SkeletonImageProps } from "antd/es/skeleton/Image"
import { SkeletonInputProps } from "antd/es/skeleton/Input"
import { SkeletonParagraphProps } from "antd/es/skeleton/Paragraph"

function AntdSkeleton(props: SkeletonProps) {
	return <Skeleton active {...props} />
}

function AntdSkeletonInput(props: SkeletonInputProps) {
	return <Skeleton.Input active {...props} />
}

function AntdSkeletonButton(props: SkeletonButtonProps) {
	return <Skeleton.Button active {...props} />
}

function AntdSkeletonImage(props: SkeletonImageProps) {
	return <Skeleton.Image active {...props} />
}

function AntdSkeletonParagraph(props: SkeletonParagraphProps) {
	return <Skeleton.Input active {...props} />
}

function AntdSkeletonAvatar(props: AvatarProps) {
	return <Skeleton.Avatar active {...props} />
}

AntdSkeleton.Input = AntdSkeletonInput
AntdSkeleton.Button = AntdSkeletonButton
AntdSkeleton.Image = AntdSkeletonImage
AntdSkeleton.Paragraph = AntdSkeletonParagraph
AntdSkeleton.Avatar = AntdSkeletonAvatar

export default AntdSkeleton
