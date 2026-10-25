import { useState } from "react"
import { useTranslation } from "react-i18next"
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from "@/components/shadcn-ui/alert-dialog"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/shadcn-ui/avatar"
import { RadioGroup, RadioGroupItem } from "@/components/shadcn-ui/radio-group"
import { cn } from "@/utils/cn"
import type {
	ThirdPartyAccountConflictContext,
	ThirdPartyAccountConflictDecision,
	ThirdPartyAccountIdentity,
} from "@/services/app/types/thirdPartyAccountReconcile"
import { Login } from "@/types/login"
import { getAvatarUrl } from "@/utils/avatar"

interface ThirdPartyAccountConflictModalProps extends ThirdPartyAccountConflictContext {
	onDecision: (decision: ThirdPartyAccountConflictDecision) => void
}

function AccountCard({
	label,
	user,
	value,
	selected,
	testId,
	radioTestId,
}: {
	label: string
	user: ThirdPartyAccountIdentity
	value: ThirdPartyAccountConflictDecision
	selected: boolean
	testId: string
	radioTestId: string
}) {
	return (
		<label
			className={cn(
				"flex min-w-0 cursor-pointer items-center gap-3 rounded-lg border border-border bg-muted/40 p-3 transition-colors hover:bg-muted/70",
				selected && "border-primary bg-primary/5 ring-1 ring-primary/20",
			)}
			data-testid={testId}
		>
			<Avatar className="size-10">
				<AvatarImage src={getAvatarUrl(user.avatar, 40)} alt={user.name} />
				<AvatarFallback className="text-sm text-muted-foreground">
					{user.name.slice(0, 1).toUpperCase()}
				</AvatarFallback>
			</Avatar>
			<div className="min-w-0 flex-1 text-left">
				<div className="text-xs text-muted-foreground">{label}</div>
				<div className="truncate text-sm font-medium text-foreground">{user.name}</div>
				{user.organizationName ? (
					<div
						className="mt-0.5 truncate text-xs text-muted-foreground"
						title={user.organizationName}
						data-testid="third-party-account-conflict-organization-name"
					>
						{user.organizationName}
					</div>
				) : null}
			</div>
			<RadioGroupItem value={value} data-testid={radioTestId} />
		</label>
	)
}

function ThirdPartyAccountConflictModal({
	platform,
	currentUser,
	candidateUser,
	onDecision,
}: ThirdPartyAccountConflictModalProps) {
	const { t } = useTranslation("login")
	const [selectedDecision, setSelectedDecision] =
		useState<ThirdPartyAccountConflictDecision>("use-candidate")

	let platformName = t("thirdPartyAccountConflict.platform.wecom")
	if (platform === Login.LoginType.DingTalkAvoid) {
		platformName = t("thirdPartyAccountConflict.platform.dingTalk")
	} else if (platform === Login.LoginType.LarkAvoid) {
		platformName = t("thirdPartyAccountConflict.platform.lark")
	}

	return (
		<AlertDialog open>
			<AlertDialogContent
				className="max-w-[calc(100vw-32px)] gap-5 sm:max-w-md"
				data-testid="third-party-account-conflict-modal"
			>
				<AlertDialogHeader className="place-items-start text-left">
					<AlertDialogTitle data-testid="third-party-account-conflict-title">
						{t("thirdPartyAccountConflict.title")}
					</AlertDialogTitle>
					<AlertDialogDescription className="text-left">
						{t("thirdPartyAccountConflict.description", { platform: platformName })}
					</AlertDialogDescription>
				</AlertDialogHeader>

				<RadioGroup
					value={selectedDecision}
					onValueChange={(value) => {
						if (value === "keep-current" || value === "use-candidate") {
							setSelectedDecision(value)
						}
					}}
					aria-label={t("thirdPartyAccountConflict.selectionLabel")}
					className="grid gap-2"
					data-testid="third-party-account-conflict-accounts"
				>
					<AccountCard
						label={t("thirdPartyAccountConflict.currentAccount")}
						user={currentUser}
						value="keep-current"
						selected={selectedDecision === "keep-current"}
						testId="third-party-account-conflict-current-account"
						radioTestId="third-party-account-conflict-current-account-radio"
					/>
					<AccountCard
						label={t("thirdPartyAccountConflict.newAccount")}
						user={candidateUser}
						value="use-candidate"
						selected={selectedDecision === "use-candidate"}
						testId="third-party-account-conflict-candidate-account"
						radioTestId="third-party-account-conflict-candidate-account-radio"
					/>
				</RadioGroup>

				<AlertDialogFooter>
					<AlertDialogAction
						onClick={() => onDecision(selectedDecision)}
						data-testid="third-party-account-conflict-confirm-button"
					>
						{t("thirdPartyAccountConflict.confirmSelection")}
					</AlertDialogAction>
				</AlertDialogFooter>
			</AlertDialogContent>
		</AlertDialog>
	)
}

export default ThirdPartyAccountConflictModal
