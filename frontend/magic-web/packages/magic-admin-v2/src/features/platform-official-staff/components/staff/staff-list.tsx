import { Bot, Edit3, Settings2, SlidersHorizontal } from "lucide-react"
import { useTranslation } from "react-i18next"
import { CopyableValue } from "@magic-admin-v2/components/copyable-value"
import { EntityAvatarRender } from "@magic-admin-v2/components/entity-avatar-render"
import { Badge } from "@magic-admin-v2/components/ui/badge"
import { Button } from "@magic-admin-v2/components/ui/button"
import { Card, CardContent } from "@magic-admin-v2/components/ui/card"
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@magic-admin-v2/components/ui/select"
import { Separator } from "@magic-admin-v2/components/ui/separator"
import { Skeleton } from "@magic-admin-v2/components/ui/skeleton"
import { Switch } from "@magic-admin-v2/components/ui/switch"
import { StaffAvatar } from "@magic-admin-v2/features/platform-official-staff/components/avatars"
import type { OfficialStaff } from "@magic-admin-v2/features/platform-official-staff/types"
import type { DefaultAgentOption } from "@magic-admin-v2/features/platform-official-staff/utils/default-agent"
import { getI18nText } from "@magic-admin-v2/features/platform-official-staff/utils/page-utils"
import { useI18n } from "@magic-admin-v2/i18n/use-i18n"

export function StaffCard({
	assignButtonTestId,
	cardTestId,
	canEdit,
	item,
	moreButtonTestId,
	onAssign,
	onEdit,
	onStatusChange,
	statusSwitchTestId,
}: {
	assignButtonTestId?: string
	cardTestId?: string
	canEdit: boolean
	item: OfficialStaff
	moreButtonTestId?: string
	onAssign: (item: OfficialStaff) => void
	onEdit: (item: OfficialStaff) => void
	onStatusChange: (item: OfficialStaff, status: boolean) => void
	statusSwitchTestId?: string
}) {
	const { t } = useTranslation()
	const { language } = useI18n()
	const isDefault = item.is_default === 1
	const name = getI18nText(item.name_i18n, language)
	const placeholder = getI18nText(item.placeholder_i18n, language)

	return (
		<Card className="min-w-0 overflow-hidden py-0" data-testid={cardTestId}>
			<CardContent className="flex min-w-0 h-full flex-col gap-4 p-4">
				<div className="flex min-w-0 gap-3">
					<StaffAvatar item={item} />
					<div className="min-w-0 flex-1">
						<div className="flex min-w-0 items-center gap-2" data-drag-preview-root>
							<div className="truncate font-medium text-foreground">{name}</div>
							{isDefault ? (
								<Badge variant="secondary">
									{t("officialStaff.badge.default")}
								</Badge>
							) : null}
						</div>
						<CopyableValue
							className="min-w-0 w-full max-w-full"
							displayValue={item.identifier}
							value={item.identifier}
						/>
					</div>
				</div>
				<p className="line-clamp-2 min-h-10 text-sm text-muted-foreground">
					{placeholder === "-" ? t("officialStaff.card.noPlaceholder") : placeholder}
				</p>
				<Separator />
				<div className="mt-auto flex items-center justify-between gap-3">
					<div className="flex min-w-0 items-center gap-2">
						<Switch
							checked={item.status}
							data-testid={statusSwitchTestId}
							disabled={!canEdit || isDefault}
							onCheckedChange={(checked) => onStatusChange(item, checked)}
						/>
						<span className="text-sm text-muted-foreground">
							{item.status ? t("common.enabled") : t("common.disabled")}
						</span>
					</div>
					<div className="flex items-center gap-2">
						<Button
							data-testid={assignButtonTestId}
							onClick={() => onAssign(item)}
							size="icon-sm"
							className="md:w-auto md:gap-1.5 md:px-2.5"
							variant="outline"
						>
							<Settings2 className="size-4" />
							<span className="hidden md:inline">
								{t("officialStaff.action.assignModels")}
							</span>
						</Button>
						{canEdit ? (
							<Button
								data-testid={moreButtonTestId}
								disabled={isDefault}
								onClick={() => onEdit(item)}
								size="icon-sm"
								className="md:w-auto md:gap-1.5 md:px-2.5"
								variant="outline"
							>
								<Edit3 className="size-4" aria-hidden="true" />
								<span className="hidden md:inline">{t("common.edit")}</span>
							</Button>
						) : null}
					</div>
				</div>
			</CardContent>
		</Card>
	)
}

export function DefaultSettingsCard({
	cardTestId,
	canEdit,
	defaultAgentCode,
	defaultAgentLoading,
	defaultAgentOptions,
	defaultAgentStaffList,
	defaultConfigItem,
	defaultAgentTriggerTestId,
	defaultConfigAssignButtonTestId,
	onAssign,
	onDefaultAgentChange,
	onFloatingOpenChange,
	openFloatingId,
}: {
	cardTestId?: string
	canEdit: boolean
	defaultAgentCode?: string
	defaultAgentLoading: boolean
	defaultAgentOptions: DefaultAgentOption[]
	defaultAgentStaffList: OfficialStaff[]
	defaultConfigItem?: OfficialStaff
	defaultAgentTriggerTestId?: string
	defaultConfigAssignButtonTestId?: string
	onAssign: (item: OfficialStaff) => void
	onDefaultAgentChange: (value: string) => void
	onFloatingOpenChange: (id: string | null) => void
	openFloatingId: string | null
}) {
	const { t } = useTranslation()
	const defaultAgentStaff = defaultAgentStaffList.find(
		(staff) => staff.identifier === defaultAgentCode,
	)

	return (
		<Card className="overflow-hidden py-0" data-testid={cardTestId}>
			<CardContent className="grid p-0 md:grid-cols-2">
				<div className="flex min-w-0 flex-col gap-3 p-4 lg:flex-row lg:items-center lg:justify-between">
					<div className="flex min-w-0 items-center gap-3">
						<EntityAvatarRender
							className="size-9"
							fallbackIcon={<Bot className="size-4" aria-hidden="true" />}
							name={defaultAgentStaff?.name_i18n?.zh_CN ?? defaultAgentCode}
							src={defaultAgentStaff?.icon_url || defaultAgentStaff?.icon}
						/>
						<div className="min-w-0">
							<div className="truncate font-medium text-foreground">
								{t("officialStaff.defaultAgent.title")}
							</div>
							<div className="line-clamp-2 text-xs text-muted-foreground">
								{t("officialStaff.defaultAgent.description")}
							</div>
						</div>
					</div>
					<div className="w-full shrink-0 lg:w-64">
						{defaultAgentLoading ? (
							<Skeleton className="h-9 w-full" />
						) : (
							<Select
								disabled={!canEdit || defaultAgentOptions.length === 0}
								onOpenChange={(open) =>
									onFloatingOpenChange(open ? "default-agent" : null)
								}
								onValueChange={onDefaultAgentChange}
								open={openFloatingId === "default-agent"}
								value={defaultAgentCode}
							>
								<SelectTrigger
									className="w-full"
									data-testid={defaultAgentTriggerTestId}
								>
									<SelectValue
										placeholder={t("officialStaff.defaultAgent.placeholder")}
									/>
								</SelectTrigger>
								<SelectContent data-testid="platform-official-staff-filter-content">
									{defaultAgentOptions.map((option) => {
										const staff = defaultAgentStaffList.find(
											(item) => item.identifier === option.value,
										)
										return (
											<SelectItem
												data-testid="platform-official-staff-option"
												disabled={option.disabled}
												key={option.value}
												textValue={option.label}
												value={option.value}
											>
												<div className="flex min-w-0 items-center gap-2">
													<EntityAvatarRender
														className="size-5"
														fallbackIcon={
															<Bot
																className="size-3"
																aria-hidden="true"
															/>
														}
														name={
															staff?.name_i18n?.zh_CN ?? option.label
														}
														src={staff?.icon_url || staff?.icon}
													/>
													<span className="truncate">{option.label}</span>
												</div>
											</SelectItem>
										)
									})}
								</SelectContent>
							</Select>
						)}
					</div>
				</div>
				<div className="flex min-w-0 flex-col gap-3 border-t p-4 lg:flex-row lg:items-center lg:justify-between md:border-l md:border-t-0">
					<div className="flex min-w-0 items-center gap-3">
						<EntityAvatarRender
							className="size-9"
							fallbackIcon={
								<SlidersHorizontal className="size-4" aria-hidden="true" />
							}
							name={t("officialStaff.builtIn.defaultConfig")}
						/>
						<div className="min-w-0">
							<div className="truncate font-medium text-foreground">
								{t("officialStaff.builtIn.defaultConfig")}
							</div>
							<div className="line-clamp-2 text-xs text-muted-foreground">
								{t("officialStaff.builtIn.defaultConfigDesc")}
							</div>
						</div>
					</div>
					{defaultConfigItem ? (
						<Button
							data-testid={defaultConfigAssignButtonTestId}
							onClick={() => onAssign(defaultConfigItem)}
							size="sm"
							variant="outline"
						>
							<Settings2 className="size-4" />
							{t("officialStaff.action.assignModels")}
						</Button>
					) : null}
				</div>
			</CardContent>
		</Card>
	)
}
