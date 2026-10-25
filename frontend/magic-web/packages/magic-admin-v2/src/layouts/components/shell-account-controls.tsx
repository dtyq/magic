import { Check, ChevronsUpDown, LogOut, Plus, RefreshCw, Building2 } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"
import { UserAvatarRender } from "@magic-admin-v2/components/user-avatar-render"
import { Button } from "@magic-admin-v2/components/ui/button"
import { RuntimeMode } from "@magic-admin-v2/constants/runtime"
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuSub,
	DropdownMenuSubContent,
	DropdownMenuSubTrigger,
	DropdownMenuTrigger,
} from "@magic-admin-v2/components/ui/dropdown-menu"
import { useTranslation } from "react-i18next"
import { useRuntime } from "@magic-admin-v2/runtime/context"
import type {
	AccountContext,
	AccountInfo,
	OrganizationInfo,
	UserInfo,
} from "@magic-admin-v2/runtime/types"

export function ShellAccountControls() {
	const { mode, account, organization, user } = useRuntime()
	const { t } = useTranslation()
	const [switchingTarget, setSwitchingTarget] = useState<string | null>(null)

	async function handleOrganizationChange(organizationCode: string) {
		if (
			organizationCode === organization.current.organizationCode ||
			!organization.switchOrganization
		) {
			return
		}

		try {
			setSwitchingTarget(organizationCode)
			await organization.switchOrganization(organizationCode)
			if (mode === RuntimeMode.Standalone) toast.success(t("userContext.switchSuccess"))
		} catch {
			toast.error(t("userContext.switchFailed"))
		} finally {
			setSwitchingTarget(null)
		}
	}

	async function handleAccountOrganizationChange(accountId: string, organizationCode: string) {
		if (!account?.switchAccountOrganization) return
		try {
			setSwitchingTarget(`${accountId}:${organizationCode}`)
			await account.switchAccountOrganization(accountId, organizationCode)
			if (mode === RuntimeMode.Standalone) toast.success(t("userContext.switchSuccess"))
		} catch {
			toast.error(t("userContext.accountSwitchFailed"))
		} finally {
			setSwitchingTarget(null)
		}
	}

	return (
		<div className="flex items-center gap-2" data-testid="shell-account-controls">
			{account ? (
				<>
					<AccountMenu
						account={account}
						currentOrganization={organization.current}
						onAddAccount={account.addAccount}
						onLogoutAccount={account.logoutAccount}
						onSwitch={(accountId, organizationCode) =>
							void handleAccountOrganizationChange(accountId, organizationCode)
						}
						switchingTarget={switchingTarget}
					/>
					<UserAvatarMenu organization={organization.current} user={user} />
				</>
			) : (
				<>
					<OrganizationSwitcher
						current={organization.current}
						disabled={!organization.switchOrganization}
						onValueChange={(value) => void handleOrganizationChange(value)}
						organizations={organization.organizations}
						switchingOrganizationCode={switchingTarget}
					/>
					<UserAvatarMenu organization={organization.current} user={user} />
				</>
			)}
		</div>
	)
}

function AccountMenu({
	account,
	onAddAccount,
	onLogoutAccount,
	onSwitch,
	currentOrganization,
	switchingTarget,
}: {
	account: AccountContext
	currentOrganization: OrganizationInfo
	onAddAccount?: () => Promise<void> | void
	onLogoutAccount?: (accountId: string) => Promise<void>
	onSwitch: (accountId: string, organizationCode: string) => void
	switchingTarget: string | null
}) {
	const { t } = useTranslation()
	const currentAccount = account.current
	const currentPlatformName = currentAccount?.platformName || t("userContext.saasPlatform")
	const otherAccounts = account.accounts.filter(
		(item) => item.accountId !== currentAccount?.accountId,
	)

	return (
		<DropdownMenu modal={false}>
			<DropdownMenuTrigger asChild data-testid="admin-layout-switch-trigger">
				<button
					aria-label={t("userContext.switchOrganization")}
					className="flex h-9 w-9 shrink-0 items-center justify-center gap-2 rounded-md border border-input bg-card px-0 text-sm font-medium shadow-sm transition-colors hover:bg-accent data-[state=open]:bg-accent sm:w-auto sm:max-w-[260px] sm:px-3"
					type="button"
					data-testid="shell-account-switcher-trigger"
				>
					<OrganizationLogo logo={currentOrganization.logo} />
					<span className="hidden min-w-0 max-w-[188px] truncate text-left sm:block">
						{currentOrganization.name}
					</span>
					<ChevronsUpDown
						aria-hidden="true"
						className="hidden size-4 text-muted-foreground sm:block"
					/>
				</button>
			</DropdownMenuTrigger>
			<DropdownMenuContent
				align="end"
				className="max-h-[min(80vh,560px)] w-[320px] overflow-y-auto rounded-lg"
				data-testid="shell-account-switcher-content"
				forceMount
			>
				{currentAccount ? (
					<>
						<DropdownMenuLabel className="flex items-center gap-2 font-normal">
							<UserAvatarRender
								className="size-7 text-[10px]"
								name={currentAccount.name}
								src={currentAccount.avatar}
							/>
							<span className="min-w-0 flex-1">
								<span className="block truncate font-medium">
									{currentAccount.name}
								</span>
								<span className="block text-xs text-muted-foreground">
									{currentPlatformName}
								</span>
							</span>
						</DropdownMenuLabel>
						<DropdownMenuSeparator />
						<div className="max-h-[min(50vh,360px)] overflow-y-auto pr-1">
							<AccountOrganizations
								account={currentAccount}
								currentOrganizationCode={currentOrganization.organizationCode}
								onSwitch={onSwitch}
								switchingTarget={switchingTarget}
							/>
						</div>
					</>
				) : null}
				{otherAccounts.length > 0 ? <DropdownMenuSeparator /> : null}
				{otherAccounts.length > 0 ? (
					<DropdownMenuLabel>{t("userContext.otherAccounts")}</DropdownMenuLabel>
				) : null}
				{otherAccounts.map((item) => (
					<OtherAccountMenu
						account={item}
						key={item.accountId}
						onLogout={onLogoutAccount}
						onSwitch={onSwitch}
						switchingTarget={switchingTarget}
					/>
				))}
				{onAddAccount ? (
					<>
						<DropdownMenuSeparator />
						<DropdownMenuItem
							data-testid="shell-account-add-account-item"
							onSelect={() => void onAddAccount()}
						>
							<Plus className="mr-2 size-4" />
							{t("userContext.addAccount")}
						</DropdownMenuItem>
					</>
				) : null}
			</DropdownMenuContent>
		</DropdownMenu>
	)
}

function AccountOrganizations({
	account,
	currentOrganizationCode,
	onSwitch,
	switchingTarget,
}: {
	account: AccountInfo
	currentOrganizationCode?: string
	onSwitch: (accountId: string, organizationCode: string) => void
	switchingTarget: string | null
}) {
	return (
		<div className="flex flex-col">
			{account.organizations.map((item) => (
				<OrganizationMenuItem
					account={account}
					current={item.organizationCode === currentOrganizationCode}
					item={item}
					key={item.organizationCode}
					onSwitch={onSwitch}
					switching={switchingTarget === `${account.accountId}:${item.organizationCode}`}
				/>
			))}
		</div>
	)
}

function OrganizationMenuItem({
	account,
	current,
	item,
	onSwitch,
	switching,
}: {
	account: AccountInfo
	current: boolean
	item: OrganizationInfo
	onSwitch: (accountId: string, organizationCode: string) => void
	switching: boolean
}) {
	return (
		<DropdownMenuItem
			className="gap-2 px-2 py-1.5"
			data-testid="shell-account-organization-item"
			disabled={switching}
			onSelect={() => {
				if (!current) onSwitch(account.accountId, item.organizationCode)
			}}
		>
			<OrganizationLogo logo={item.logo} />
			<span className="min-w-0 flex-1">
				<span className="block truncate text-sm leading-5">{item.name}</span>
				<span className="block truncate text-xs leading-4 text-muted-foreground">
					{item.organizationCode}
				</span>
			</span>
			{switching ? (
				<RefreshCw className="ml-auto size-3 animate-spin" />
			) : current ? (
				<Check className="ml-auto size-4" />
			) : null}
		</DropdownMenuItem>
	)
}

function OtherAccountMenu({
	account,
	onLogout,
	onSwitch,
	switchingTarget,
}: {
	account: AccountInfo
	onLogout?: (accountId: string) => Promise<void>
	onSwitch: (accountId: string, organizationCode: string) => void
	switchingTarget: string | null
}) {
	const { t } = useTranslation()
	const platformName = account.platformName || t("userContext.saasPlatform")
	return (
		<DropdownMenuSub>
			<DropdownMenuSubTrigger
				className="gap-2"
				data-testid="shell-account-other-account-trigger"
			>
				<UserAvatarRender
					className="size-6 text-[10px]"
					name={account.name}
					src={account.avatar}
				/>
				<span className="min-w-0 flex-1 truncate">{account.name}</span>
				<span className="max-w-[92px] truncate text-xs text-muted-foreground">
					{platformName}
				</span>
			</DropdownMenuSubTrigger>
			<DropdownMenuSubContent
				className="max-h-[min(70vh,420px)] w-[280px] overflow-y-auto"
				data-testid="shell-account-other-account-content"
			>
				<div className="pr-1">
					{account.organizations.map((item) => (
						<OrganizationMenuItem
							account={account}
							current={false}
							item={item}
							key={item.organizationCode}
							onSwitch={onSwitch}
							switching={
								switchingTarget === `${account.accountId}:${item.organizationCode}`
							}
						/>
					))}
				</div>
				{onLogout ? (
					<>
						<DropdownMenuSeparator />
						<DropdownMenuItem
							className="text-destructive"
							data-testid="shell-account-logout-item"
							onSelect={() => void onLogout(account.accountId)}
						>
							<LogOut className="mr-2 size-4" />
							{t("userContext.logoutAccount")}
						</DropdownMenuItem>
					</>
				) : null}
			</DropdownMenuSubContent>
		</DropdownMenuSub>
	)
}

function OrganizationSwitcher({
	current,
	disabled,
	onValueChange,
	organizations,
	switchingOrganizationCode,
}: {
	current: OrganizationInfo
	disabled: boolean
	onValueChange: (value: string) => void
	organizations: readonly OrganizationInfo[]
	switchingOrganizationCode: string | null
}) {
	const { t } = useTranslation()

	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild data-testid="admin-layout-shell-account-logout-trigger">
				<button
					aria-label={t("userContext.switchOrganization")}
					className="flex h-9 w-9 shrink-0 items-center justify-center gap-2 rounded-md border border-input bg-card px-0 text-sm font-medium shadow-sm transition-colors hover:bg-accent data-[state=open]:bg-accent disabled:pointer-events-none disabled:opacity-60 sm:w-auto sm:max-w-[260px] sm:px-3"
					disabled={disabled || switchingOrganizationCode !== null}
					data-testid="shell-organization-switcher-trigger"
					type="button"
				>
					<OrganizationLogo logo={current.logo} />
					<span className="hidden min-w-0 max-w-[188px] truncate text-left sm:block">
						{current.name}
					</span>
					<ChevronsUpDown
						className="hidden size-4 text-muted-foreground sm:block"
						aria-hidden="true"
					/>
				</button>
			</DropdownMenuTrigger>
			<DropdownMenuContent
				align="end"
				className="max-h-80 w-[260px] overflow-y-auto rounded-lg"
				data-testid="shell-organization-switcher-content"
			>
				<DropdownMenuLabel className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
					{t("userContext.switchOrganization")}
				</DropdownMenuLabel>
				<DropdownMenuSeparator />
				{organizations.map((organization) => (
					<DropdownMenuItem
						className="gap-2 px-2 py-1.5"
						data-testid="shell-organization-item"
						key={organization.organizationCode}
						onSelect={() => onValueChange(organization.organizationCode)}
					>
						<OrganizationLogo logo={organization.logo} />
						<span className="min-w-0 flex-1">
							<span className="block truncate text-sm font-medium leading-5">
								{organization.name}
							</span>
							<span className="block truncate text-xs leading-4 text-muted-foreground">
								{organization.organizationCode}
							</span>
						</span>
						{switchingOrganizationCode === organization.organizationCode ? (
							<RefreshCw className="ml-auto size-3 animate-spin text-muted-foreground" />
						) : organization.organizationCode === current.organizationCode ? (
							<Check className="ml-auto size-4" />
						) : null}
					</DropdownMenuItem>
				))}
			</DropdownMenuContent>
		</DropdownMenu>
	)
}

function OrganizationLogo({ logo }: { logo?: string }) {
	return (
		<span
			aria-hidden="true"
			className="flex size-6 shrink-0 items-center justify-center overflow-hidden rounded border bg-muted text-muted-foreground"
		>
			{logo ? (
				<img alt="" className="size-full object-cover" src={logo} />
			) : (
				<Building2 className="size-3.5" />
			)}
		</span>
	)
}

function UserAvatarMenu({
	organization,
	user,
}: {
	organization: OrganizationInfo
	user: UserInfo | null
}) {
	const { t } = useTranslation()
	const displayName = user?.name || "Admin"

	return (
		<DropdownMenu modal={false}>
			<DropdownMenuTrigger asChild data-testid="admin-layout-filter-trigger">
				<Button
					aria-label={t("userContext.userMenu")}
					className="relative h-8 w-8 rounded-full"
					data-testid="shell-user-menu-trigger"
					variant="ghost"
				>
					<UserAvatarRender
						className="size-8 text-xs"
						name={displayName}
						src={user?.avatar}
					/>
				</Button>
			</DropdownMenuTrigger>
			<DropdownMenuContent
				className="w-56"
				align="end"
				data-testid="shell-user-menu-content"
				forceMount
			>
				<DropdownMenuLabel className="font-normal">
					<div className="flex flex-col space-y-1">
						<p className="text-sm leading-none font-medium">{displayName}</p>
						<p className="truncate text-xs leading-none text-muted-foreground">
							{organization.name}
						</p>
					</div>
				</DropdownMenuLabel>
			</DropdownMenuContent>
		</DropdownMenu>
	)
}
