import { SkeletonSafeAreaWrapper } from "@/components/base/Skeleton"
import MessageTypeSegmented from "@/pages/chatMobile/components/MessageTypeSegmented"
import UserHeader from "@/pages/chatMobile/components/UserHeader"
import useSegmentedOptions from "@/pages/chatMobile/hooks/useSegmentedOptions"
import { ChatListSkeleton } from "./ChatListSkeleton"

/**
 * Chat 移动端骨架屏组件
 * 对应页面: src/pages/chatMobile/index.tsx
 */
export default function ChatMobileSkeleton() {
	const segmentedOptions = useSegmentedOptions()

	return (
		<SkeletonSafeAreaWrapper
			topStyle={{ backgroundColor: "#ffffff" }}
			enableTop={true}
			enableBottom={false}
		>
			<div
				style={{
					display: "flex",
					flexDirection: "column",
					height: "100%",
					backgroundColor: "#f5f5f5",
				}}
			>
				<UserHeader
					wrapperClassName="!border-b-0"
					center={
						// Message Types
						<MessageTypeSegmented options={segmentedOptions} value="chat" />
					}
				/>

				<ChatListSkeleton />
			</div>
		</SkeletonSafeAreaWrapper>
	)
}
