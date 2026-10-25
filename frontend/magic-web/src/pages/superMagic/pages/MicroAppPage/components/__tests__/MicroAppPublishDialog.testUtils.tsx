import { render } from "@testing-library/react"
import type { ComponentProps, ReactNode } from "react"
import { vi } from "vitest"
import { userStore } from "@/models/user"
import { ShareType } from "@/pages/superMagic/components/Share/types"
import { Admin } from "@/types/admin"
import MicroAppPublishDialog from "../MicroAppPublishDialog"

const mocks = vi.hoisted(() => ({
	getMicroAppProject: vi.fn(),
	getShareInfoByCode: vi.fn(),
	publishMicroAppProject: vi.fn(),
	unpublishMicroAppProject: vi.fn(),
	getFileUrl: vi.fn(),
	uploadAndGetFileUrl: vi.fn(),
	successToast: vi.fn(),
	errorToast: vi.fn(),
	writeText: vi.fn(),
	confirmModal: vi.fn(),
	functionPermissions: {} as Record<string, boolean>,
	useUploadOptions: undefined as Record<string, unknown> | undefined,
	t: (key: string, options?: Record<string, string>) => {
		if (options?.time) return `${key}:${options.time}`
		if (options?.projectName) return `${key}:${options.projectName}`
		if (options?.password) return `${key}:${options.password}`
		return key
	},
}))

export function getPublishDialogMocks() {
	return mocks
}

vi.mock("@/apis", () => ({
	FUNCTION_PERMISSION_CODE: {
		MicroAppSharePassword: "micro_app.share_password",
		MicroAppSharePublic: "micro_app.share_public",
		MicroAppShareTeam: "micro_app.share_team",
		ProjectSharePassword: "project.share_password",
		ProjectSharePublic: "project.share_public",
		ProjectShareTeam: "project.share_team",
	},
	FileApi: {
		getFileUrl: mocks.getFileUrl,
	},
	SuperMagicApi: {
		getMicroAppProject: mocks.getMicroAppProject,
		getShareInfoByCode: mocks.getShareInfoByCode,
		publishMicroAppProject: mocks.publishMicroAppProject,
		unpublishMicroAppProject: mocks.unpublishMicroAppProject,
	},
}))

vi.mock("@/hooks/useFunctionPermission", () => ({
	useFunctionPermissions: () => ({
		data: mocks.functionPermissions,
		error: undefined,
		isLoading: false,
		mutate: vi.fn(),
	}),
}))

vi.mock("react-i18next", () => ({
	useTranslation: () => ({ t: mocks.t }),
}))

vi.mock("@/hooks/useUploadFiles", () => ({
	useUpload: (options: Record<string, unknown>) => {
		mocks.useUploadOptions = options
		return {
			uploadAndGetFileUrl: mocks.uploadAndGetFileUrl,
			uploading: false,
		}
	},
}))

vi.mock("@/components/base/MagicToaster/utils", () => ({
	default: {
		success: mocks.successToast,
		error: mocks.errorToast,
	},
}))

vi.mock("@/utils/clipboard-helpers", () => ({
	clipboard: { writeText: mocks.writeText },
}))

vi.mock("@/components/base/MagicModal", async () => {
	const React = await import("react")
	const MagicModal = Object.assign(
		({
			open,
			children,
			title,
		}: {
			open?: boolean
			children?: React.ReactNode
			title?: React.ReactNode
		}) =>
			open
				? React.createElement(
						"div",
						{ "data-testid": "mock-magic-modal" },
						React.createElement("h2", null, title),
						children,
					)
				: null,
		{ confirm: mocks.confirmModal },
	)
	return { default: MagicModal }
})

vi.mock("@/components/base-mobile/MagicPopup", () => ({
	default: ({
		children,
		visible,
		position,
		className,
		bodyClassName,
		headerVariant,
		headerTitle,
		headerLeadingAction,
	}: {
		children: ReactNode
		visible?: boolean
		position?: string
		className?: string
		bodyClassName?: string
		headerVariant?: string
		headerTitle?: ReactNode
		headerLeadingAction?: { onClick: () => void; testId?: string }
	}) =>
		visible ? (
			<div
				data-testid="mobile-publish-popup"
				data-position={position}
				data-header-variant={headerVariant}
				data-body-class-name={bodyClassName}
				className={className}
			>
				{headerLeadingAction ? (
					<button
						type="button"
						data-testid={headerLeadingAction.testId}
						onClick={headerLeadingAction.onClick}
					/>
				) : null}
				{headerTitle}
				{children}
			</div>
		) : null,
}))

vi.mock("@/pages/superMagic/components/Share/ShareFields", async () => {
	const React = await import("react")
	return {
		ShareTypeField: ({
			value,
			onChange,
			availableTypes,
			permittedTypes,
		}: {
			value: ShareType
			onChange: (type: ShareType) => void
			availableTypes: ShareType[]
			permittedTypes?: ShareType[]
		}) =>
			React.createElement(
				"div",
				{ "data-testid": "share-type-field", "data-value": value },
				permittedTypes?.includes(ShareType.Public) !== false
					? React.createElement(
							"button",
							{
								type: "button",
								"data-testid": "share-type-public",
								onClick: () => onChange(4),
							},
							"public",
						)
					: null,
				availableTypes.includes(ShareType.Organization) &&
					permittedTypes?.includes(ShareType.Organization) !== false
					? React.createElement(
							"button",
							{
								type: "button",
								"data-testid": "share-type-organization",
								onClick: () => onChange(ShareType.Organization),
							},
							"organization",
						)
					: null,
				React.createElement(
					"button",
					{
						type: "button",
						"data-testid": "force-share-type-organization",
						onClick: () => onChange(ShareType.Organization),
					},
					"force organization",
				),
			),
		ShareRangeField: () => React.createElement("div", { "data-testid": "share-range-field" }),
		ShareExpiryField: ({
			value,
			onChange,
		}: {
			value: number | null
			onChange: (value: number | null) => void
		}) =>
			React.createElement(
				"button",
				{
					type: "button",
					"data-testid": "share-expiry-field",
					"data-value": value === null ? "permanent" : String(value),
					onClick: () => onChange(value === null ? 30 : null),
				},
				"expiry",
			),
	}
})

export function renderDialog(props: Partial<ComponentProps<typeof MicroAppPublishDialog>> = {}) {
	return render(
		<MicroAppPublishDialog
			open
			appId="app-1"
			projectName="Demo App"
			onProjectNameChange={vi.fn()}
			onOpenChange={vi.fn()}
			{...props}
		/>,
	)
}

export function createPasswordProtectedDetail() {
	return {
		app_id: "app-1",
		project_id: "project-1",
		project: { id: "project-1", project_name: "Demo App" },
		publish: {
			app_id: "app-1",
			app_name: "Demo App",
			resource_id: "resource-1",
			share_code: "share-code-1",
			share_type: ShareType.PasswordProtected,
			publish_status: "published",
			access_url: "https://example.com/micro-app/app-1",
		},
	}
}

/**
 * The sharing gate only reads `is_paid_plan`; the remaining subscription fields are placeholders so
 * tests do not repeat a fourteen-field literal. Resetting it to `null` (an unknown plan) keeps the
 * default suite on the paid path — an unknown plan must never be treated as free.
 */
export function setOrganizationSubscription(isPaidPlan: boolean) {
	userStore.user.setOrganizationSubscriptionInfo({
		id: "subscription-1",
		product_id: "product-1",
		product_sku_id: "sku-1",
		name: "Test Plan",
		start_date: "2026-01-01",
		end_date: "2027-01-01",
		renewal_type: "auto",
		payment_cycle: "monthly",
		level: 1,
		plan_type: Admin.PlanType.Team,
		seat_count: 1,
		is_paid_plan: isPaidPlan,
		is_recharge_points: false,
		pending_subscriptions: [],
	})
}

export function resetPublishDialogMocks() {
	vi.clearAllMocks()
	userStore.user.setIsPersonalOrganization(false)
	userStore.user.setOrganizationSubscriptionInfo(null)
	mocks.functionPermissions = {
		"micro_app.share_password": true,
		"micro_app.share_public": true,
		"micro_app.share_team": true,
	}
	mocks.useUploadOptions = undefined
	mocks.getMicroAppProject.mockResolvedValue({
		app_id: "app-1",
		project_id: "project-1",
		project: { id: "project-1", project_name: "Demo App" },
		publish: null,
	})
	mocks.publishMicroAppProject.mockResolvedValue({
		app_id: "app-1",
		app_name: "Demo App",
		resource_id: "resource-1",
		share_type: ShareType.Public,
		publish_status: "published",
		access_url: "https://example.com/micro-app/app-1",
	})
	mocks.getShareInfoByCode.mockResolvedValue({ password: "" })
	mocks.getFileUrl.mockResolvedValue({ url: "https://cdn.example.com/existing-cover.png" })
	mocks.uploadAndGetFileUrl.mockResolvedValue({
		fullfilled: [
			{
				value: {
					path: "micro-app/covers/new.png",
					url: "https://cdn.example.com/cover.png",
				},
			},
		],
	})
	mocks.confirmModal.mockImplementation(({ onOk }: { onOk?: () => void }) => onOk?.())
}
