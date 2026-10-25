import { fireEvent, render, screen } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import RecordingShareManagementDialog from "../RecordingShareManagementDialog"
import { SharedTopicFilterStatus } from "@/pages/superMagic/components/ShareManagement/types"
import type { AttachmentItem } from "@/pages/superMagic/components/TopicFilesButton/hooks/types"

const corePropsMock = vi.hoisted(() => ({
	props: [] as Array<{
		projectId: string
		filterStatus: SharedTopicFilterStatus
		currentPage: number
		pageSize: number
		fileShareUiConfig?: { hideManageShareLinks?: boolean }
		onTotalPagesChange?: (totalPages: number) => void
	}>,
}))

vi.mock("react-i18next", () => ({
	useTranslation: (namespace: string) => ({
		t: (key: string) => {
			const labels: Record<string, string> = {
				"detail.shareManagementTitle": "Recording share management",
				"detail.shareStatusFilter": "Share status",
				"shareManagement.filterStatus.active": "Active",
				"shareManagement.filterStatus.expired": "Expired",
				"shareManagement.filterStatus.cancelled": "Cancelled",
				"shareManagement.previousPage": "Previous",
				"shareManagement.nextPage": "Next",
			}
			return labels[key] ?? `${namespace}:${key}`
		},
	}),
}))

vi.mock("@/components/base/MagicModal", () => ({
	default: ({
		title,
		open,
		children,
	}: {
		title: React.ReactNode
		open: boolean
		children: React.ReactNode
	}) =>
		open ? (
			<div data-testid="magic-modal-mock">
				<div>{title}</div>
				{children}
			</div>
		) : null,
}))

vi.mock("@/components/shadcn-ui/select", () => ({
	Select: ({
		value,
		onValueChange,
		children,
	}: {
		value: string
		onValueChange: (value: string) => void
		children: React.ReactNode
	}) => (
		<select
			data-testid="recording-share-management-status-select"
			value={value}
			onChange={(event) => onValueChange(event.target.value)}
		>
			{children}
		</select>
	),
	SelectTrigger: ({ children }: { children: React.ReactNode }) => <>{children}</>,
	SelectValue: () => null,
	SelectContent: ({ children }: { children: React.ReactNode }) => <>{children}</>,
	SelectItem: ({ value, children }: { value: string; children: React.ReactNode }) => (
		<option value={value}>{children}</option>
	),
}))

vi.mock(
	"@/pages/superMagic/components/ShareManagement/components/FileShareManagementListCore",
	() => ({
		default: (props: (typeof corePropsMock.props)[number]) => {
			corePropsMock.props.push(props)
			return <div data-testid="file-share-management-list-core" />
		},
	}),
)

vi.mock("@/pages/superMagic/components/ShareManagement/components/ShareListFooter", () => ({
	default: ({
		currentPage,
		onPageChange,
	}: {
		currentPage: number
		onPageChange: (page: number) => void
	}) => (
		<button
			type="button"
			data-testid="share-list-next-page"
			onClick={() => onPageChange(currentPage + 1)}
		>
			Next page
		</button>
	),
}))

describe("RecordingShareManagementDialog", () => {
	beforeEach(() => {
		corePropsMock.props = []
	})

	it("shows only status filtering for current project file shares", () => {
		render(
			<RecordingShareManagementDialog open projectId="project-demo-001" onClose={vi.fn()} />,
		)

		expect(screen.getByTestId("recording-share-management-dialog")).toBeInTheDocument()
		expect(screen.getByText("Recording share management")).toBeInTheDocument()
		expect(screen.queryByText("Shared Projects")).not.toBeInTheDocument()
		expect(screen.queryByText("Shared Files")).not.toBeInTheDocument()
		expect(screen.queryByText("Shared Topics")).not.toBeInTheDocument()
		expect(screen.queryByPlaceholderText(/search/i)).not.toBeInTheDocument()
		expect(corePropsMock.props.at(-1)).toMatchObject({
			projectId: "project-demo-001",
			filterStatus: SharedTopicFilterStatus.Active,
			currentPage: 1,
			pageSize: 10,
			fileShareUiConfig: {
				hideManageShareLinks: true,
			},
		})
	})

	it("passes recording dependency context to edit shares", () => {
		const dependencyAttachments: AttachmentItem[] = [
			{ file_id: "file-demo-001", file_name: "notes.md" },
		]

		render(
			<RecordingShareManagementDialog
				open
				projectId="project-demo-001"
				dependencyAttachments={dependencyAttachments}
				dependencyBundleRootPath="recording-demo"
				onClose={vi.fn()}
			/>,
		)

		expect(corePropsMock.props.at(-1)?.fileShareUiConfig).toMatchObject({
			dependencyAttachments,
			dependencyBundleRootPath: "recording-demo",
			analyzeSelectedDocuments: true,
			autoIncludeDocumentDependencies: true,
		})
	})

	it("resets pagination when status changes", () => {
		render(
			<RecordingShareManagementDialog open projectId="project-demo-001" onClose={vi.fn()} />,
		)

		fireEvent.click(screen.getByTestId("share-list-next-page"))
		expect(corePropsMock.props.at(-1)).toMatchObject({ currentPage: 2 })

		fireEvent.change(screen.getByTestId("recording-share-management-status-select"), {
			target: { value: SharedTopicFilterStatus.Cancelled },
		})

		expect(corePropsMock.props.at(-1)).toMatchObject({
			filterStatus: SharedTopicFilterStatus.Cancelled,
			currentPage: 1,
		})
	})
})
