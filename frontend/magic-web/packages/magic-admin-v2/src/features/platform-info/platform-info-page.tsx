import {
	AlertCircle,
	Bot,
	Droplets,
	Edit3,
	FileText,
	Info,
	RefreshCw,
	Save,
	Search,
	Globe2,
	X,
} from "lucide-react"
import { useCallback, useEffect, useMemo, useState } from "react"
import { useForm, type Resolver } from "react-hook-form"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { zodResolver } from "@hookform/resolvers/zod"
import { EmptyState } from "@magic-admin-v2/components/empty-state"
import { ListShell } from "@magic-admin-v2/components/list-shell"
import { PageHeaderActionButton } from "@magic-admin-v2/components/page-header-action-button"
import {
	SectionNavigation,
	SectionNavigationSkeleton,
	type SectionNavigationItem,
} from "@magic-admin-v2/components/section-navigation"
import { Badge } from "@magic-admin-v2/components/ui/badge"
import { Skeleton } from "@magic-admin-v2/components/ui/skeleton"
import { PERMISSION_KEY_MAP } from "@magic-admin-v2/constants/permissions"
import {
	createEmptyPlatformInfoFormState,
	toChangedPlatformInfoParams,
	toPlatformInfoFormState,
} from "@magic-admin-v2/features/platform-info/api"
import { PlatformInfoForm } from "@magic-admin-v2/features/platform-info/components/platform-info-form"
import { PlatformInfoPreview } from "@magic-admin-v2/features/platform-info/components/platform-info-preview"
import { useUpdatePlatformInfoMutation } from "@magic-admin-v2/features/platform-info/mutations"
import { usePlatformInfoQuery } from "@magic-admin-v2/features/platform-info/queries"
import type {
	PlatformInfoFormState,
	PlatformLocale,
} from "@magic-admin-v2/features/platform-info/types"
import {
	createPlatformInfoSchema,
	getMutationErrorMessage,
	platformInfoSectionTitleKeys,
	type PlatformInfoSectionId,
} from "@magic-admin-v2/features/platform-info/utils"
import { useRights } from "@magic-admin-v2/hooks/use-rights"
import { Language } from "@magic-admin-v2/i18n/resources"
import type { ApiError } from "@magic-admin-v2/api/types"
import { cn } from "@magic-admin-v2/utils/cn"

const platformInfoSections = [
	{
		id: "basic",
		titleKey: platformInfoSectionTitleKeys.basic,
		icon: Info,
	},
	{
		id: "seo",
		titleKey: platformInfoSectionTitleKeys.seo,
		icon: Search,
	},
	{
		id: "agentPrompt",
		titleKey: platformInfoSectionTitleKeys.agentPrompt,
		icon: Bot,
	},
	{
		id: "globalSystemPrompt",
		titleKey: platformInfoSectionTitleKeys.globalSystemPrompt,
		icon: Globe2,
	},
	{
		id: "footer",
		titleKey: platformInfoSectionTitleKeys.footer,
		icon: FileText,
	},
	{
		id: "watermark",
		titleKey: platformInfoSectionTitleKeys.watermark,
		icon: Droplets,
	},
] satisfies Array<SectionNavigationItem<PlatformInfoSectionId>>

export default function PlatformInfoPage() {
	const { t } = useTranslation()
	const hasEditRight = useRights(PERMISSION_KEY_MAP.PLATFORM_INFO_MANAGEMENT_EDIT)
	const [contentLocale, setContentLocale] = useState<PlatformLocale>(Language.ZhCN)
	const [activeSection, setActiveSection] = useState<PlatformInfoSectionId>("basic")
	const [isEditing, setIsEditing] = useState(false)
	const [imageUploadCount, setImageUploadCount] = useState(0)
	const schema = useMemo(() => createPlatformInfoSchema(t, activeSection), [t, activeSection])
	const form = useForm<PlatformInfoFormState>({
		defaultValues: createEmptyPlatformInfoFormState(),
		resolver: zodResolver(schema) as Resolver<PlatformInfoFormState>,
	})
	const platformInfoQuery = usePlatformInfoQuery()
	const updateMutation = useUpdatePlatformInfoMutation()
	const draft = form.watch()

	const formState = useMemo(() => {
		if (!platformInfoQuery.data) {
			return null
		}

		return toPlatformInfoFormState(platformInfoQuery.data)
	}, [platformInfoQuery.data])

	const visibleState = isEditing ? draft : formState
	const queryError = platformInfoQuery.error as ApiError | null
	const isImageUploading = imageUploadCount > 0
	const handleImageUploadingChange = useCallback((uploading: boolean) => {
		setImageUploadCount((count) => Math.max(0, count + (uploading ? 1 : -1)))
	}, [])

	useEffect(() => {
		if (formState && !isEditing) {
			form.reset(formState)
		}
	}, [form, formState, isEditing])

	useEffect(() => {
		// Each tab has its own schema. Do not carry validation errors from a
		// previous tab into the newly selected section.
		form.clearErrors()
	}, [activeSection, form])

	function startEditing() {
		if (!hasEditRight) return

		if (formState) {
			form.reset(formState)
		}
		setIsEditing(true)
	}

	function cancelEditing() {
		if (formState) {
			form.reset(formState)
		}
		setIsEditing(false)
		setImageUploadCount(0)
	}

	async function saveDraft(values: PlatformInfoFormState) {
		if (!hasEditRight) return

		try {
			const params = toChangedPlatformInfoParams(values, form.formState.dirtyFields)
			const saved = await updateMutation.mutateAsync(params)
			form.reset(toPlatformInfoFormState(saved))
			setIsEditing(false)
			toast.success(t("platformInfo.message.saveSuccess"))
		} catch (error) {
			toast.error(getMutationErrorMessage(error, t))
		}
	}

	if (platformInfoQuery.isLoading) {
		return <PlatformInfoSkeleton hasEditRight={hasEditRight} />
	}

	if (queryError && !visibleState) {
		return (
			<ListShell
				actions={
					<PageHeaderActionButton
						data-testid="platform-info-refresh-button"
						onClick={() => platformInfoQuery.refetch()}
						variant="outline"
					>
						<RefreshCw className="size-4" aria-hidden="true" />
						{t("common.refresh")}
					</PageHeaderActionButton>
				}
				description={t("nav.desc.platformInfo")}
				testId="platform-info-page"
				title={t("nav.item.platformInfo")}
			>
				<EmptyState
					icon={AlertCircle}
					testId="platform-info-error"
					title={t("platformInfo.error.loadTitle")}
					description={queryError.message}
				/>
			</ListShell>
		)
	}

	if (!visibleState) {
		return null
	}

	return (
		<ListShell
			actions={
				isEditing ? (
					<>
						<PageHeaderActionButton
							data-testid="platform-info-cancel-button"
							disabled={updateMutation.isPending}
							onClick={cancelEditing}
							variant="outline"
						>
							<X className="size-4" aria-hidden="true" />
							{t("common.cancel")}
						</PageHeaderActionButton>
						<PageHeaderActionButton
							data-testid="platform-info-save-button"
							disabled={
								updateMutation.isPending ||
								isImageUploading ||
								!form.formState.isDirty
							}
							onClick={form.handleSubmit(saveDraft)}
						>
							<Save className="size-4" aria-hidden="true" />
							{updateMutation.isPending ? t("common.saving") : t("common.save")}
						</PageHeaderActionButton>
					</>
				) : (
					<>
						<PageHeaderActionButton
							data-testid="platform-info-refresh-button"
							disabled={platformInfoQuery.isFetching}
							onClick={() => platformInfoQuery.refetch()}
							variant="outline"
						>
							<RefreshCw
								className={cn(
									"size-4",
									platformInfoQuery.isFetching && "animate-spin",
								)}
								aria-hidden="true"
							/>
							{t("common.refresh")}
						</PageHeaderActionButton>
						{hasEditRight ? (
							<PageHeaderActionButton
								data-testid="platform-info-edit-button"
								onClick={startEditing}
							>
								<Edit3 className="size-4" aria-hidden="true" />
								{t("common.edit")}
							</PageHeaderActionButton>
						) : null}
					</>
				)
			}
			contentClassName="space-y-4"
			description={t("nav.desc.platformInfo")}
			testId="platform-info-page"
			title={t("nav.item.platformInfo")}
			titleAddon={
				isEditing ? (
					<Badge variant="outline">{t("platformInfo.badge.editing")}</Badge>
				) : null
			}
		>
			<div className="md:hidden">
				<SectionNavigation
					mode="select"
					sections={platformInfoSections}
					testIdPrefix="platform-info-sections"
					value={activeSection}
					onValueChange={setActiveSection}
				/>
			</div>
			<div className="hidden md:block lg:hidden">
				<SectionNavigation
					mode="tabs"
					sections={platformInfoSections}
					testIdPrefix="platform-info-sections"
					value={activeSection}
					onValueChange={setActiveSection}
				/>
			</div>
			<div className="flex min-h-0 gap-12" data-testid="platform-info-loading">
				<aside className="hidden shrink-0 lg:block lg:w-52">
					<SectionNavigation
						mode="nav"
						sections={platformInfoSections}
						testIdPrefix="platform-info-sections"
						value={activeSection}
						onValueChange={setActiveSection}
					/>
				</aside>
				<div
					className="min-w-0 flex-1"
					data-testid={isEditing ? "platform-info-form" : "platform-info-preview"}
				>
					{isEditing ? (
						<PlatformInfoForm
							activeSection={activeSection}
							contentLocale={contentLocale}
							form={form}
							onContentLocaleChange={setContentLocale}
							onImageUploadingChange={handleImageUploadingChange}
							value={draft}
						/>
					) : (
						<PlatformInfoPreview
							activeSection={activeSection}
							contentLocale={contentLocale}
							onContentLocaleChange={setContentLocale}
							value={visibleState}
						/>
					)}
				</div>
			</div>
		</ListShell>
	)
}

function PlatformInfoSkeleton({ hasEditRight }: { hasEditRight: boolean }) {
	const { t } = useTranslation()

	return (
		<ListShell
			actions={
				<>
					<PageHeaderActionButton
						data-testid="platform-info-refresh-button"
						disabled
						variant="outline"
					>
						<RefreshCw className="size-4" aria-hidden="true" />
						{t("common.refresh")}
					</PageHeaderActionButton>
					{hasEditRight ? (
						<PageHeaderActionButton data-testid="platform-info-edit-button" disabled>
							<Edit3 className="size-4" aria-hidden="true" />
							{t("common.edit")}
						</PageHeaderActionButton>
					) : null}
				</>
			}
			contentClassName="space-y-4"
			description={t("nav.desc.platformInfo")}
			testId="platform-info-page"
			title={t("nav.item.platformInfo")}
		>
			<div className="md:hidden">
				<SectionNavigationSkeleton mode="select" sections={platformInfoSections} />
			</div>
			<div className="hidden md:block lg:hidden">
				<SectionNavigationSkeleton mode="tabs" sections={platformInfoSections} />
			</div>
			<div className="flex min-h-0 gap-12" data-testid="platform-info-loading">
				<aside className="hidden shrink-0 lg:block lg:w-52">
					<SectionNavigationSkeleton mode="nav" sections={platformInfoSections} />
				</aside>
				<div className="min-w-0 flex-1">
					<div className="space-y-2">
						<Skeleton className="h-6 w-24" />
						<Skeleton className="h-4 w-full max-w-xl" />
					</div>
					<div className="faded-bottom mt-4">
						<div className="-mx-1 px-1.5 pb-12 pe-4">
							<div className="space-y-6">
								<div className="grid gap-3 sm:grid-cols-2">
									{Array.from({ length: 4 }).map((_, index) => (
										<div
											className="rounded-md border bg-background p-3"
											key={index}
										>
											<Skeleton className="mb-3 h-4 w-24" />
											<Skeleton className="h-24 w-full rounded-md" />
										</div>
									))}
								</div>
								<div className="divide-y rounded-md border">
									{Array.from({ length: 3 }).map((_, index) => (
										<div
											className="grid gap-2 px-4 py-3 md:grid-cols-[180px_1fr]"
											key={index}
										>
											<Skeleton className="h-4 w-24" />
											<Skeleton className="h-4 w-full max-w-md" />
										</div>
									))}
								</div>
							</div>
						</div>
					</div>
				</div>
			</div>
		</ListShell>
	)
}
