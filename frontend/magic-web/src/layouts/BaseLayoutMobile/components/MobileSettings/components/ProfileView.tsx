import type { KeyboardEvent } from "react"
import { Camera } from "lucide-react"

import MagicAvatar from "@/components/base/MagicAvatar"
import { Input } from "@/components/shadcn-ui/input"

export interface MobileSettingsProfileViewProps {
	avatar?: string
	nickname: string
	canUpdateAvatar: boolean
	canUpdateNickname: boolean
	onNicknameChange: (nickname: string) => void
	onPickAvatar: () => void
	onConfirm: () => void
	onCancel: () => void
	isAvatarActionDisabled?: boolean
	nicknameLabel: string
	nicknamePlaceholder: string
	avatarAriaLabel: string
}

/** 个人资料 View：按 update-permission 分别展示可编辑头像/昵称或只读态。 */
export function MobileSettingsProfileView(props: MobileSettingsProfileViewProps) {
	const {
		avatar,
		nickname,
		canUpdateAvatar,
		canUpdateNickname,
		onNicknameChange,
		onPickAvatar,
		onConfirm,
		onCancel,
		isAvatarActionDisabled = false,
		nicknameLabel,
		nicknamePlaceholder,
		avatarAriaLabel,
	} = props

	const avatarNode = (
		<MagicAvatar src={avatar} size={96} style={{ borderRadius: 9999 }} className="shadow-sm">
			{nickname || "?"}
		</MagicAvatar>
	)

	/** 键盘快捷键：Enter 保存昵称，Escape 关闭 Sheet。 */
	function handleNicknameKeyDown(event: KeyboardEvent<HTMLInputElement>) {
		if (!canUpdateNickname) return
		if (event.key === "Enter") onConfirm()
		if (event.key === "Escape") onCancel()
	}

	return (
		<div className="flex flex-col gap-4 pt-2">
			<div className="flex flex-col items-center py-1">
				{canUpdateAvatar ? (
					<button
						type="button"
						onClick={onPickAvatar}
						disabled={isAvatarActionDisabled}
						className="relative rounded-full transition-opacity active:opacity-80 disabled:cursor-not-allowed disabled:opacity-60"
						aria-label={avatarAriaLabel}
						data-testid="mobile-settings-profile-avatar-button"
					>
						{avatarNode}
						<span
							className="absolute bottom-0 right-0 flex size-7 items-center justify-center rounded-full bg-foreground text-background shadow-lg shadow-black/10 ring-2 ring-muted"
							aria-hidden
						>
							<Camera className="size-3.5" strokeWidth={2.5} />
						</span>
					</button>
				) : (
					<div
						className="relative rounded-full"
						data-testid="mobile-settings-profile-avatar-readonly"
					>
						{avatarNode}
					</div>
				)}
			</div>

			{canUpdateNickname ? (
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
			) : (
				<div className="flex flex-col gap-2">
					<div className="px-3.5 text-sm leading-5 text-muted-foreground">
						{nicknameLabel}
					</div>
					<div
						className="overflow-hidden rounded-xl bg-card px-3.5 py-3 text-base text-foreground"
						data-testid="mobile-settings-profile-nickname-readonly"
					>
						{nickname || "-"}
					</div>
				</div>
			)}
		</div>
	)
}
