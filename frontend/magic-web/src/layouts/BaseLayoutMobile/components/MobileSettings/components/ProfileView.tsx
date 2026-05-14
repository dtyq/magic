import type { KeyboardEvent } from "react"
import { Camera } from "lucide-react"

import MagicAvatar from "@/components/base/MagicAvatar"
import { Input } from "@/components/shadcn-ui/input"

export interface MobileSettingsProfileViewProps {
	avatar?: string
	nickname: string
	onNicknameChange: (nickname: string) => void
	onPickAvatar: () => void
	onConfirm: () => void
	onCancel: () => void
	isAvatarActionDisabled?: boolean
	nicknameLabel: string
	nicknamePlaceholder: string
	avatarAriaLabel: string
}

/** 个人资料 View 只负责移动端展示和事件分发，真实上传与保存逻辑由 Sheet 容器承接。 */
export function MobileSettingsProfileView(props: MobileSettingsProfileViewProps) {
	const {
		avatar,
		nickname,
		onNicknameChange,
		onPickAvatar,
		onConfirm,
		onCancel,
		isAvatarActionDisabled = false,
		nicknameLabel,
		nicknamePlaceholder,
		avatarAriaLabel,
	} = props

	/** 键盘快捷键保持编辑 Sheet 的轻交互一致：Enter 保存，Escape 取消。 */
	function handleNicknameKeyDown(event: KeyboardEvent<HTMLInputElement>) {
		if (event.key === "Enter") onConfirm()
		if (event.key === "Escape") onCancel()
	}

	return (
		<div className="flex flex-col gap-4 pt-2">
			<div className="flex flex-col items-center py-1">
				<button
					type="button"
					onClick={onPickAvatar}
					disabled={isAvatarActionDisabled}
					className="relative rounded-full transition-opacity active:opacity-80 disabled:cursor-not-allowed disabled:opacity-60"
					aria-label={avatarAriaLabel}
					data-testid="mobile-settings-profile-avatar-button"
				>
					<MagicAvatar
						src={avatar}
						size={96}
						style={{ borderRadius: 9999 }}
						className="shadow-sm"
					>
						{nickname || "?"}
					</MagicAvatar>
					<span
						className="absolute bottom-0 right-0 flex size-7 items-center justify-center rounded-full bg-foreground text-background shadow-lg shadow-black/10 ring-2 ring-muted"
						aria-hidden
					>
						<Camera className="size-3.5" strokeWidth={2.5} />
					</span>
				</button>
			</div>

			<div className="flex flex-col gap-2">
				<div className="px-3.5 text-sm leading-5 text-muted-foreground">
					{nicknameLabel}
				</div>
				<div className="overflow-hidden rounded-xl bg-card">
					<Input
						type="text"
						value={nickname}
						onChange={(event) => onNicknameChange(event.target.value)}
						onKeyDown={handleNicknameKeyDown}
						placeholder={nicknamePlaceholder}
						autoFocus
						className="h-12 rounded-none border-0 bg-transparent px-3.5 text-base shadow-none focus-visible:ring-0"
						data-testid="mobile-settings-profile-nickname-input"
					/>
				</div>
			</div>
		</div>
	)
}
