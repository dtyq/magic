import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import TopicSharePopover from "../index"

const popoverContentProps = vi.hoisted(() => ({
	onFocusOutside: undefined as undefined | ((event: { preventDefault: () => void }) => void),
}))

const deviceMocks = vi.hoisted(() => ({
	isMagicApp: false,
	isNoHoverCoarsePointer: false,
}))

vi.mock("@/hooks/useIsMobile", () => ({ useIsMobile: () => true }))

vi.mock("react-i18next", () => ({
	useTranslation: () => ({
		t: (key: string) => key,
	}),
}))

vi.mock("ahooks", async () => {
	const actual = await vi.importActual<typeof import("ahooks")>("ahooks")
	return {
		...actual,
		useResponsive: () => ({ md: true }),
	}
})

vi.mock("@/utils/devices", () => ({
	get isMagicApp() {
		return deviceMocks.isMagicApp
	},
	isNoHoverCoarsePointer: () => deviceMocks.isNoHoverCoarsePointer,
}))

vi.mock("@/services/analytics", () => ({
	analyticsService: { report: vi.fn() },
}))

vi.mock("@/apis", () => ({
	FUNCTION_PERMISSION_CODE: {
		MicroAppSharePassword: "micro_app.share_password",
		MicroAppSharePublic: "micro_app.share_public",
		MicroAppShareTeam: "micro_app.share_team",
		ProjectSharePassword: "project.share_password",
		ProjectSharePublic: "project.share_public",
		ProjectShareTeam: "project.share_team",
		TopicSharePassword: "topic.share_password",
		TopicSharePublic: "topic.share_public",
	},
	SuperMagicApi: {
		getShareInfoByCode: vi.fn().mockResolvedValue(null),
		createShareTopic: vi.fn(),
		createOrUpdateShareResource: vi.fn(),
		cancelShareResource: vi.fn(),
	},
}))

// Share methods are unrestricted here; this suite only covers popover dismissal behavior.
vi.mock("@/hooks/useFunctionPermission", () => ({
	useFunctionPermissions: () => ({
		data: undefined,
		error: undefined,
		isLoading: true,
		mutate: vi.fn(),
	}),
}))

vi.mock("@/utils/clipboard-helpers", () => ({
	clipboard: {
		writeText: vi.fn(),
	},
}))

vi.mock("@/components/base/MagicToaster/utils", () => ({
	default: {
		success: vi.fn(),
		error: vi.fn(),
	},
}))

vi.mock("@/pages/superMagic/components/VipSwitch", () => ({
	VipBadge: () => <span data-testid="vip-badge" />,
	VipSwitch: ({ checked }: { checked?: boolean }) => (
		<input data-testid="vip-switch" readOnly type="checkbox" checked={checked} />
	),
}))

vi.mock("@/pages/superMagic/components/Share/ShareFields", () => ({
	SharePasswordField: () => <div data-testid="share-password-field" />,
}))

vi.mock("@/components/shadcn-ui/popover", () => ({
	Popover: ({ children }: { children: React.ReactNode }) => (
		<div data-testid="desktop-topic-share-popover">{children}</div>
	),
	PopoverTrigger: ({ children }: { children: React.ReactNode }) => <>{children}</>,
	PopoverContent: ({
		children,
		onFocusOutside,
	}: {
		children: React.ReactNode
		onFocusOutside?: (event: { preventDefault: () => void }) => void
	}) => {
		popoverContentProps.onFocusOutside = onFocusOutside
		return <div>{children}</div>
	},
}))

vi.mock("@/pages/superMagicMobile/components/CommonPopup", () => ({
	default: ({
		children,
		popupProps,
	}: {
		children: React.ReactNode
		popupProps?: { visible?: boolean }
	}) => (
		<div data-testid="app-topic-share-popup" data-visible={String(popupProps?.visible)}>
			{children}
		</div>
	),
}))

vi.mock("../styles", () => ({
	useStyles: () => ({
		styles: {
			container: "container",
			switchRow: "switch-row",
			switchLabel: "switch-label",
			switchTitle: "switch-title",
			switchDescription: "switch-description",
			fieldGroup: "field-group",
			fieldLabel: "field-label",
			advancedSection: "advanced-section",
			advancedHeader: "advanced-header",
			advancedTitle: "advanced-title",
			advancedContent: "advanced-content",
		},
	}),
}))

describe("TopicSharePopover on phones with a trigger", () => {
	it("pads the sheet content like the desktop popover", () => {
		render(
			<TopicSharePopover
				open
				onOpenChange={vi.fn()}
				topicId="mock-topic-id"
				topicTitle="Mock topic"
			>
				<button type="button">share</button>
			</TopicSharePopover>,
		)

		const sheet = screen.getByTestId("app-topic-share-popup")
		expect(sheet.firstElementChild?.className).toContain("p-3.5")
	})
})
