import { useMemo } from "react"
import { keyBy } from "lodash-es"
import { observer } from "mobx-react-lite"
import { Check, ChevronRight, LogOut, Plus, SquareUserRound } from "lucide-react"
import { useTranslation } from "react-i18next"
import { useMemoizedFn } from "ahooks"
import { Avatar, AvatarFallback, AvatarImage } from "@/opensource/components/shadcn-ui/avatar"
import { Badge } from "@/opensource/components/shadcn-ui/badge"
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/opensource/components/shadcn-ui/dropdown-menu"
import { ScrollArea } from "@/opensource/components/shadcn-ui/scroll-area"
import { Separator } from "@/opensource/components/shadcn-ui/separator"
import { cn } from "@/opensource/lib/utils"
import { useAccount as useAccountHook } from "@/opensource/models/user/hooks"
import openAccountModal from "@/opensource/pages/login/AccountModal"
import { useClusterConfig } from "@/opensource/models/config/hooks"
import { useClusterCode } from "@/opensource/providers/ClusterProvider"
import type { User } from "@/opensource/types/user"
import { userStore } from "@/opensource/models/user"
import useLogout from "@/opensource/hooks/account/useLogout"
import MagicEmpty from "@/opensource/components/base/MagicEmpty"
import useCancelRecord from "@/opensource/components/business/RecordingSummary/hooks/useCancelRecord"
import { useSwitchOrganization } from "@/opensource/hooks/account/useSwitchOrganization"
import PersonalOrganizationAvatar from "@/opensource/assets/resources/personal-organization-avatar.svg"
import TeamOrganizationAvatar from "@/opensource/assets/resources/team-organization-avatar.svg"
import { getAvatarUrl } from "@/opensource/utils/avatar"
import { toTestIdSegment } from "@/opensource/utils/testid"

export interface OrganizationListItemProps {
	onClose?: () => void
	organizationFilter?: (org: User.UserOrganization) => boolean
}

interface OrganizationOption {
	thirdPlatformOrganization: User.UserOrganization
	magicOrganization?: User.MagicOrganization
}

const getOrganizationOptions = (
	account: User.UserAccount,
	organizationFilter?: (org: User.UserOrganization) => boolean,
): OrganizationOption[] => {
	const organizationMap = keyBy(account.organizations, "third_platform_organization_code")
	return Object.values(organizationMap).map((o) => {
		return {
			thirdPlatformOrganization: {} as User.UserOrganization,
			magicOrganization: o,
		}
	})
}

function OrganizationList(props: OrganizationListItemProps) {
	const { onClose, organizationFilter } = props
	const { t: tSuper } = useTranslation("super")
	const { t: tSidebar } = useTranslation("sidebar")

	const { accounts } = useAccountHook()
	const { clustersConfig } = useClusterConfig()
	const { setClusterCode } = useClusterCode()

	const { userInfo } = userStore.user
	const currentAccount = useMemo(
		() => accounts.find((account) => account.magic_id === userInfo?.magic_id),
		[accounts, userInfo?.magic_id],
	)
	const otherAccounts = useMemo(
		() => accounts.filter((account) => account.magic_id !== userInfo?.magic_id),
		[accounts, userInfo?.magic_id],
	)

	const switchOrganization = useSwitchOrganization({
		disabled: false,
		onSwitchAfter: onClose,
	})

	const { cancelRecord } = useCancelRecord({
		noNeedButtonText: tSuper("recordingSummary.cancelModal.noNeedWithContinue"),
		summarizeButtonText: tSuper("recordingSummary.cancelModal.summarizeWithContinue"),
		modalContent: tSuper("recordingSummary.cancelModal.messageWithContinue"),
		aiRecordingModalContent: tSuper("recordingSummary.aiRecordingModal.switchContent"),
		aiRecordingConfirmText: tSuper("recordingSummary.aiRecordingModal.switchConfirmText"),
	})

	const handleAddAccount = useMemoizedFn(async () => {
		try {
			await cancelRecord()

			openAccountModal({
				// 当且仅当帐号登录成功后，根据账号信息所在集群同步至当前上下文
				onClusterChange(code) {
					setClusterCode(code)
				},
			})
			onClose?.()
		} catch (error) {
			console.error(error)
		}
	})

	const handleSwitchOrganization = useMemoizedFn(
		async (account: User.UserAccount, organization?: User.MagicOrganization) => {
			try {
				if (!organization) {
					return
				}

				await cancelRecord()
				await switchOrganization(account, organization)
			} catch (error) {
				console.error(error)
			}
		},
	)

	const getPlatformName = useMemoizedFn((account: User.UserAccount) => {
		return (
			clustersConfig?.[account.deployCode]?.name ||
			tSidebar("organizationSwitch.saasPlatform")
		)
	})

	const logout = useLogout()
	const handleLogoutAccount = useMemoizedFn((account: User.UserAccount) => {
		void logout(account)
		onClose?.()
	})

	const renderOrganizationItem = useMemoizedFn(
		(
			account: User.UserAccount,
			option: OrganizationOption,
			inDropdown = false,
		): JSX.Element => {
			const { magicOrganization, thirdPlatformOrganization } = option

			console.log("magicOrganization", magicOrganization, thirdPlatformOrganization)
			const organizationCode =
				magicOrganization?.magic_organization_code ??
				thirdPlatformOrganization.organization_code
			const organizationOptionTestId = `user-menus-organization-option-${toTestIdSegment(
				`${account.magic_id}-${organizationCode}`,
			)}`
			const isSelected = userInfo?.user_id === magicOrganization?.magic_user_id
			const isDisabled = !magicOrganization

			const organizationName = thirdPlatformOrganization.is_personal_organization
				? tSidebar("organizationSwitch.personalVersion")
				: thirdPlatformOrganization.organization_name ||
					magicOrganization?.magic_organization_code ||
					thirdPlatformOrganization.organization_code

			const logoSource = thirdPlatformOrganization.is_personal_organization
				? PersonalOrganizationAvatar
				: thirdPlatformOrganization.organization_logo?.[0]?.url ||
					magicOrganization?.organization_logo ||
					TeamOrganizationAvatar

			const baseClassName = cn(
				"flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-[14px] font-normal leading-5 text-foreground transition-colors",
				"hover:bg-accent",
				{
					"cursor-not-allowed opacity-50 hover:bg-transparent": isDisabled,
					"bg-sidebar-accent hover:bg-sidebar-accent": isSelected && !inDropdown,
				},
			)

			if (inDropdown) {
				return (
					<DropdownMenuItem
						key={
							magicOrganization?.magic_organization_code ??
							thirdPlatformOrganization.organization_code
						}
						data-testid="user-menus-organization-option"
						className={baseClassName}
						disabled={isDisabled}
						onSelect={() => {
							void handleSwitchOrganization(account, magicOrganization)
						}}
					>
						<Avatar className="size-6 rounded-[4px] bg-muted">
							{logoSource ? (
								<AvatarImage
									src={getAvatarUrl(logoSource, 36)}
									alt={organizationName}
									className="rounded-[4px] object-cover"
								/>
							) : null}
							<AvatarFallback className="rounded-[4px] bg-muted text-muted-foreground">
								<SquareUserRound className="size-3.5" />
							</AvatarFallback>
						</Avatar>
						<span
							className="min-w-0 flex-1 truncate text-[14px] font-normal leading-5"
							data-testid={organizationOptionTestId}
						>
							{organizationName}
						</span>
					</DropdownMenuItem>
				)
			}

			return (
				<button
					key={
						magicOrganization?.magic_organization_code ??
						thirdPlatformOrganization.organization_code
					}
					type="button"
					data-testid="user-menus-organization-option"
					className={baseClassName}
					disabled={isDisabled}
					onClick={() => {
						void handleSwitchOrganization(account, magicOrganization)
					}}
				>
					<Avatar className="size-6 rounded-[4px] bg-muted">
						{logoSource ? (
							<AvatarImage
								src={getAvatarUrl(logoSource, 36)}
								alt={organizationName}
								className="rounded-[4px] object-cover"
							/>
						) : null}
						<AvatarFallback className="rounded-[4px] bg-muted text-muted-foreground">
							<SquareUserRound className="size-3.5" />
						</AvatarFallback>
					</Avatar>
					<span
						className="min-w-0 flex-1 truncate text-[14px] font-normal leading-5"
						data-testid={organizationOptionTestId}
					>
						{organizationName}
					</span>
					{isSelected ? (
						<span className="flex size-4 items-center justify-center rounded-sm bg-foreground text-background">
							<Check className="size-3" strokeWidth={2.5} />
						</span>
					) : null}
				</button>
			)
		},
	)

	const renderSectionLabel = useMemoizedFn((label: string) => {
		return (
			<div className="flex w-full flex-col items-start px-2 py-1.5">
				<p className="min-h-px min-w-px flex-1 text-xs leading-5 text-muted-foreground">
					{label}
				</p>
			</div>
		)
	})

	return (
		<div
			className="flex h-full w-[300px] max-w-[90vw] flex-col gap-1 overflow-hidden rounded-md border border-border bg-popover p-1 shadow-md"
			data-testid="user-menus-organization-list-content"
		>
			{accounts.length === 0 ? (
				<MagicEmpty style={{ width: "100%" }} />
			) : (
				<>
					{currentAccount ? (
						<>
							{renderSectionLabel(tSidebar("organizationSwitch.currentAccount"))}
							<div
								className="relative flex w-full items-center gap-2 rounded-sm py-1.5 pl-8 pr-2 text-[14px] font-normal leading-5 text-foreground"
								data-testid="user-menus-current-account"
							>
								<SquareUserRound className="absolute left-2 size-4 text-muted-foreground" />
								<span className="min-w-0 flex-1 truncate text-[14px] font-normal leading-5">
									{currentAccount.nickname}
								</span>
								<Badge
									variant="outline"
									className="h-5 max-w-[120px] rounded-md border-border bg-transparent px-2 py-0.5 text-[12px] font-normal leading-4 text-foreground"
								>
									<span className="truncate text-[12px] font-normal leading-4">
										{getPlatformName(currentAccount)}
									</span>
								</Badge>
							</div>
							<div className="relative w-full pl-8">
								<div className="absolute bottom-0 left-4 top-0 w-px bg-border" />
								<div className="flex w-full flex-col gap-0.5">
									<ScrollArea
										type="always"
										className="w-full [&_[data-slot='scroll-area-scrollbar']]:bg-transparent"
										viewportClassName="max-h-[50vh] pr-3 scroll-smooth [&>div]:!block"
									>
										{getOrganizationOptions(
											currentAccount,
											organizationFilter,
										).map((option) =>
											renderOrganizationItem(currentAccount, option, false),
										)}
									</ScrollArea>
								</div>
							</div>
						</>
					) : null}

					{otherAccounts.length > 0 ? (
						<>
							{renderSectionLabel(tSidebar("organizationSwitch.otherAccount"))}
							{otherAccounts.map((account) => {
								const options = getOrganizationOptions(account, organizationFilter)
								const accountIdSegment = toTestIdSegment(account.magic_id)
								const otherAccountTestId = `user-menus-other-account-${accountIdSegment}`
								const otherAccountMenuTestId = `user-menus-other-account-menu-${accountIdSegment}`
								const logoutAccountTestId = `user-menus-logout-account-${accountIdSegment}`
								return (
									<DropdownMenu key={account.magic_id} modal={false}>
										<DropdownMenuTrigger asChild>
											<button
												type="button"
												data-testid="user-menus-other-account"
												className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-[14px] font-normal leading-5 text-foreground transition-colors hover:bg-accent"
											>
												<SquareUserRound className="size-4 text-foreground" />
												<span
													className="min-w-0 flex-1 truncate text-[14px] font-normal leading-5"
													data-testid={otherAccountTestId}
												>
													{account.nickname}
												</span>
												<span className="max-w-[110px] truncate text-[14px] font-normal leading-5 text-muted-foreground">
													{getPlatformName(account)}
												</span>
												<ChevronRight className="size-4 text-muted-foreground" />
											</button>
										</DropdownMenuTrigger>
										<DropdownMenuContent
											side="right"
											align="start"
											sideOffset={6}
											className="z-[1200] max-h-[80vh] w-[300px] rounded-md border border-border bg-popover p-1 shadow-md"
											data-testid={otherAccountMenuTestId}
										>
											{options.map((option) =>
												renderOrganizationItem(account, option, true),
											)}
											<Separator className="my-1" />
											<DropdownMenuItem
												data-testid="user-menus-logout-account"
												className="relative cursor-pointer rounded-sm py-1.5 pl-8 pr-2 text-[14px] font-normal leading-5 text-destructive transition-colors hover:bg-destructive/10 hover:text-destructive focus:bg-destructive/10 focus:text-destructive data-[highlighted]:bg-destructive/10 data-[highlighted]:text-destructive"
												onSelect={() => {
													handleLogoutAccount(account)
												}}
											>
												<LogOut className="absolute left-2 size-4 text-destructive" />
												<span data-testid={logoutAccountTestId}>
													{tSidebar("organizationSwitch.logoutAccount")}
												</span>
											</DropdownMenuItem>
										</DropdownMenuContent>
									</DropdownMenu>
								)
							})}
						</>
					) : null}
				</>
			)}

			<Separator className="my-1" />
			<button
				type="button"
				data-testid="user-menus-add-account"
				className="relative flex w-full items-center rounded-sm py-1.5 pl-8 pr-2 text-left text-[14px] font-normal leading-5 text-foreground transition-colors hover:bg-accent"
				onClick={() => {
					void handleAddAccount()
				}}
			>
				<Plus className="absolute left-2 size-4" />
				{tSidebar("organizationSwitch.addAccount")}
			</button>
		</div>
	)
}

export default observer(OrganizationList)
