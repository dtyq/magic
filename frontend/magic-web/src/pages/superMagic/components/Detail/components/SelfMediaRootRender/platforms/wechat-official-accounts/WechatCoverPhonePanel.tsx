import { useTranslation } from "react-i18next"
import { ChevronLeft, Search, User } from "lucide-react"
import { cn } from "@/lib/utils"
import PhoneShell from "../../components/PhoneShell"
import { usePhoneScaling } from "../../hooks/usePhoneScaling"
import type { PlatformComponentProps, SelfMediaPost } from "../../types"
import WechatCoverView from "./cover"
import { WechatOfficialContentGate } from "./WechatOfficialContentGate"
import {
	WECHAT_NAV_BAR_HEIGHT,
	WECHAT_PHONE_HEIGHT,
	WECHAT_PHONE_WIDTH,
	WECHAT_STATUS_BAR_HEIGHT,
} from "./wechatShellConstants"

interface EnsurePostLoaded {
	(index: number): Promise<SelfMediaPost | null>
}

export interface WechatCoverPhonePanelProps {
	visible: boolean
	loading: boolean
	error: string | null
	posts: SelfMediaPost[]
	attachmentList?: PlatformComponentProps["attachmentList"]
	onSelectPost: (idx: number) => void
	onEnsurePostLoaded?: EnsurePostLoaded
}

function WechatTopNavBar({ title }: { title: string }) {
	return (
		<div
			className="flex w-full items-center justify-between bg-white px-3"
			style={{ height: WECHAT_NAV_BAR_HEIGHT }}
		>
			<button
				type="button"
				className="flex h-9 w-9 items-center justify-center text-[#1a1a1a]"
				aria-label="back"
				data-testid="wechat-nav-back"
			>
				<ChevronLeft className="h-6 w-6" strokeWidth={2.2} />
			</button>
			<div className="min-w-0 flex-1 truncate text-center text-[17px] font-semibold text-[#1a1a1a]">
				{title}
			</div>
			<div className="flex items-center gap-1">
				<button
					type="button"
					className="flex h-9 w-9 items-center justify-center text-[#1a1a1a]"
					aria-label="search"
					data-testid="wechat-nav-search"
				>
					<Search className="h-[22px] w-[22px]" strokeWidth={2} />
				</button>
				<button
					type="button"
					className="flex h-9 w-9 items-center justify-center text-[#1a1a1a]"
					aria-label="profile"
					data-testid="wechat-nav-profile"
				>
					<User className="h-[22px] w-[22px]" strokeWidth={2} />
				</button>
			</div>
		</div>
	)
}

export function WechatCoverPhonePanel(props: WechatCoverPhonePanelProps) {
	const { visible, loading, error, posts, attachmentList, onSelectPost, onEnsurePostLoaded } =
		props
	const { t } = useTranslation("super")
	const { containerRef, scale } = usePhoneScaling<HTMLDivElement>({
		designWidth: WECHAT_PHONE_WIDTH + 28,
		designHeight: WECHAT_PHONE_HEIGHT + 28,
	})

	const navTitle = t("detail.selfMedia.platform.wechat-official-accounts.cover.navTitle")

	return (
		<div
			ref={containerRef}
			className={cn("absolute inset-0", visible ? "block" : "hidden")}
			aria-hidden={!visible}
			data-testid="wechat-cover-phone-panel"
		>
			<div className="flex h-full items-start justify-center py-4">
				<PhoneShell
					scale={scale}
					width={WECHAT_PHONE_WIDTH}
					height={WECHAT_PHONE_HEIGHT}
					theme="dark"
				>
					<div
						className="flex h-full w-full flex-col bg-white"
						style={{ paddingTop: WECHAT_STATUS_BAR_HEIGHT }}
					>
						<WechatTopNavBar title={navTitle} />
						<div className="relative flex-1 overflow-hidden">
							<WechatOfficialContentGate
								loading={loading}
								error={error}
								hasPost={posts.length > 0}
							>
								<WechatCoverView
									posts={posts}
									attachmentList={attachmentList}
									onSelectPost={onSelectPost}
									onEnsurePostLoaded={onEnsurePostLoaded}
								/>
							</WechatOfficialContentGate>
						</div>
					</div>
				</PhoneShell>
			</div>
		</div>
	)
}

export default WechatCoverPhonePanel
