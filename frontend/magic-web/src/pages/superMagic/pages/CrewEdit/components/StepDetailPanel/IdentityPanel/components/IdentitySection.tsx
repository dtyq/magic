import { useRef, useCallback } from "react"
import { Upload, Loader2 } from "lucide-react"
import { observer } from "mobx-react-lite"
import { Button } from "@/components/shadcn-ui/button"
import { IdentityNameField } from "./IdentityNameField"
import { IdentityRoleField } from "./IdentityRoleField"
import { useCrewEditStore } from "../../../../context"
import { useMemberDisplay } from "../../../../hooks/useMemberDisplay"
import { RoleIcon } from "../../../common/RoleIcon"
import { useUpload } from "@/hooks/useUploadFiles"

interface IdentitySectionProps {
	disabled?: boolean
	onOpenLocalize?: (tab: "name" | "role") => void
}

function IdentitySectionInner({ disabled = false, onOpenLocalize }: IdentitySectionProps) {
	const store = useCrewEditStore()
	const { identity, skills } = store
	const { name, avatarUrl } = useMemberDisplay({
		name_i18n: identity.name_i18n,
		role_i18n: identity.role_i18n,
		description_i18n: identity.description_i18n,
		icon: identity.icon,
		prompt: identity.prompt,
		skills: skills.skills,
	})

	const { uploadAndGetFileUrl, uploading: avatarUploading } = useUpload({
		storageType: "public",
	})

	const avatarInputRef = useRef<HTMLInputElement>(null)
	const handleAvatarClick = useCallback(() => {
		if (disabled) return
		avatarInputRef.current?.click()
	}, [disabled])

	const handleAvatarChange = useCallback(
		async (e: React.ChangeEvent<HTMLInputElement>) => {
			if (disabled) return
			const file = e.target.files?.[0]
			if (!file) return
			e.target.value = ""

			const result = await uploadAndGetFileUrl([{ name: file.name, file, status: "init" }])
			const url = result?.fullfilled?.[0]?.value?.url
			if (url) identity.setAvatarUrl(url)
		},
		[disabled, identity, uploadAndGetFileUrl],
	)

	return (
		<div className="flex flex-col items-center gap-2.5">
			{/* Avatar */}
			<div className="group relative rounded-3xl border border-border bg-card p-3">
				<div className="h-[50px] w-[50px]">
					{avatarUrl ? (
						<img
							src={avatarUrl}
							alt={name}
							className="h-full w-full rounded-xl object-cover"
						/>
					) : (
						<div className="flex h-full w-full items-center justify-center">
							<RoleIcon className="h-[44px] w-[44px]" />
						</div>
					)}
				</div>
				<input
					ref={avatarInputRef}
					type="file"
					accept="image/*"
					className="hidden"
					onChange={handleAvatarChange}
					data-testid="crew-avatar-file-input"
				/>
				<Button
					variant="outline"
					size="icon"
					className="absolute -bottom-[4px] -right-[4px] size-6 rounded-lg bg-background opacity-0 shadow-xs transition-opacity disabled:opacity-100 group-hover:opacity-100"
					onClick={handleAvatarClick}
					disabled={disabled || avatarUploading}
					data-testid="crew-avatar-upload-button"
				>
					{avatarUploading ? (
						<Loader2 className="h-4 w-4 animate-spin" />
					) : (
						<Upload className="h-4 w-4" />
					)}
				</Button>
			</div>

			{/* Name */}
			<IdentityNameField
				disabled={disabled}
				onClick={onOpenLocalize ? () => onOpenLocalize("name") : undefined}
			/>

			{/* Role */}
			<IdentityRoleField
				disabled={disabled}
				onClick={onOpenLocalize ? () => onOpenLocalize("role") : undefined}
			/>
		</div>
	)
}

export const IdentitySection = observer(IdentitySectionInner)
