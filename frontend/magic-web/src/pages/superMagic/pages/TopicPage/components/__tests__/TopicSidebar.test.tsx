import type { ReactNode } from "react"
import { beforeEach, describe, it, expect, vi } from "vitest"
import { fireEvent, render, screen } from "@testing-library/react"
import TopicSidebar from "../TopicSidebar"

vi.mock("react-i18next", () => ({
	useTranslation: () => ({
		t: (key: string) => key,
	}),
}))

vi.mock("@/pages/superMagic/components/ProjectCardContainer", () => ({
	default: () => <div data-testid="project-card-container" />,
}))

vi.mock("@/pages/superMagic/components/ProjectSider", () => ({
	default: ({
		items,
		headerTrailingAction,
	}: {
		items: Array<{ key: string; title: string; content?: ReactNode }>
		headerTrailingAction?: ReactNode
	}) => (
		<div data-testid="project-sider">
			{headerTrailingAction}
			{items.map((item) => (
				<div key={item.key}>
					<span data-testid={`project-sider-item-${item.key}`}>{item.title}</span>
					<div data-testid={`project-sider-content-${item.key}`}>{item.content}</div>
				</div>
			))}
		</div>
	),
}))

vi.mock("@/pages/superMagic/components/TopicFilesButton", () => ({
	default: ({ title }: { title?: string }) => (
		<div data-testid="topic-files-button">{title ?? "topicFiles.title"}</div>
	),
}))

vi.mock("@/pages/superMagic/components/SiderTask", () => ({
	default: () => <div data-testid="sider-task" />,
}))

vi.mock("@/pages/superMagic/components/UserSpace/UserSpacePanel", () => ({
	default: () => <div data-testid="user-space-panel" />,
}))

vi.mock("@/pages/superMagic/components/ShareManagement/ShareManagementPanel", () => ({
	default: () => <div data-testid="share-management-panel" />,
}))

vi.mock("@/enhance/tabler/icons-react/icons/iconShareCog", () => ({
	default: () => <span data-testid="icon-share-cog" />,
}))

const controllerState = vi.hoisted(() => ({ isAudioProject: false }))

vi.mock("../../hooks/useAudioProjectSidebarController", () => ({
	useAudioProjectSidebarController: ({ isReadOnly }: { isReadOnly: boolean }) => ({
		isAudioProject: controllerState.isAudioProject,
		canManageAudioProject: controllerState.isAudioProject && !isReadOnly,
		projectItem: controllerState.isAudioProject
			? {
					id: "mock-audio-project",
					project_name: "Mock recording",
					card_status: "summarized",
					workspace_id: null,
				}
			: null,
		title: "Mock recording",
		groups: [],
		ungroupedCount: 0,
		moveGroupOpen: false,
		setMoveGroupOpen: vi.fn(),
		actions: {
			summarySubmitting: false,
			renaming: false,
			deleting: false,
			moving: false,
			canGenerateSummary: true,
		},
		copyController: {},
		shareController: {
			openShareModal: vi.fn(),
			shareModalOpen: false,
			closeShareModal: vi.fn(),
			defaultSelectedFileIds: [],
			editingResourceId: undefined,
		},
		handleBack: vi.fn(),
		handleDelete: vi.fn(),
		renameProject: vi.fn(async () => true),
		moveToGroup: vi.fn(async () => true),
		copyToProject: vi.fn(),
		generateSummary: vi.fn(),
		summaryMode: "regenerate",
		ungroupedGroupId: "ungrouped",
	}),
}))

vi.mock("@/pages/superMagic/components/AudioProjectHeader", () => ({
	default: () => <div data-testid="audio-project-header" />,
}))

vi.mock("@/pages/superMagic/pages/AudioRecordings/components/AudioRecordingGroupDialogs", () => ({
	AudioRecordingMoveGroupDialog: () => null,
}))

vi.mock("@/pages/superMagic/pages/AudioRecordings/components/AudioRecordingCopyDialog", () => ({
	AudioRecordingCopyDialog: () => null,
}))

vi.mock("@/pages/superMagic/components/Share/Modal", () => ({
	default: () => null,
}))

vi.mock("../AudioProjectShareDialogs", () => ({
	default: () => null,
}))

const baseProps = {
	selectedProject: { id: "project-alpha" },
	selectedWorkspace: { id: "workspace-alpha" },
	selectedTopic: { id: "topic-alpha" },
	isReadOnly: false,
	topicFilesProps: {},
}

describe("TopicSidebar", () => {
	beforeEach(() => {
		controllerState.isAudioProject = false
	})

	it("renders all sider tabs in default variant", () => {
		render(<TopicSidebar {...baseProps} />)

		expect(screen.getByTestId("project-sider-item-topicFiles")).toHaveTextContent(
			"topicFiles.title",
		)
		expect(screen.getByTestId("topic-files-button")).toHaveTextContent("topicFiles.title")
		expect(screen.getByTestId("project-sider-item-task")).toBeInTheDocument()
		expect(screen.getByTestId("project-sider-item-userSpace")).toBeInTheDocument()
		expect(screen.getByTestId("project-sider-item-share")).toBeInTheDocument()
	})

	it("renders only files and share tabs in chat variant", () => {
		render(<TopicSidebar {...baseProps} siderVariant="chat" hideProjectCard />)

		expect(screen.getByTestId("project-sider-item-topicFiles")).toHaveTextContent(
			"topicFiles.fileTitle",
		)
		expect(screen.getByTestId("topic-files-button")).toHaveTextContent("topicFiles.fileTitle")
		expect(screen.getByTestId("project-sider-item-share")).toBeInTheDocument()
		expect(screen.queryByTestId("project-sider-item-task")).not.toBeInTheDocument()
		expect(screen.queryByTestId("project-sider-item-userSpace")).not.toBeInTheDocument()
		expect(screen.queryByTestId("project-card-container")).not.toBeInTheDocument()
	})

	it("puts the collapse control beside the sider tabs for chat and calls onCollapse", () => {
		const onCollapse = vi.fn()
		render(
			<TopicSidebar
				{...baseProps}
				siderVariant="chat"
				hideProjectCard
				onCollapse={onCollapse}
			/>,
		)

		fireEvent.click(screen.getByTestId("project-card-collapse"))
		expect(onCollapse).toHaveBeenCalledTimes(1)
	})

	it("does not render a header collapse control when the sidebar cannot collapse", () => {
		render(<TopicSidebar {...baseProps} siderVariant="chat" hideProjectCard />)

		expect(screen.queryByTestId("project-card-collapse")).not.toBeInTheDocument()
	})

	it("keeps only the file tree for recording projects", () => {
		controllerState.isAudioProject = true
		render(
			<TopicSidebar
				{...baseProps}
				topicFilesProps={{ attachments: [{ file_id: "mock-file" }] }}
			/>,
		)

		expect(screen.getByTestId("audio-project-header")).toBeInTheDocument()
		expect(screen.getByTestId("project-sider-item-topicFiles")).toBeInTheDocument()
		expect(screen.queryByTestId("project-sider-item-task")).not.toBeInTheDocument()
		expect(screen.queryByTestId("project-sider-item-userSpace")).not.toBeInTheDocument()
		expect(screen.queryByTestId("project-sider-item-share")).not.toBeInTheDocument()
	})

	it("hides recording management actions for read-only projects", () => {
		controllerState.isAudioProject = true
		render(
			<TopicSidebar
				{...baseProps}
				isReadOnly
				topicFilesProps={{ attachments: [{ file_id: "mock-file" }] }}
			/>,
		)

		expect(screen.getByTestId("audio-project-header")).toBeInTheDocument()
		expect(screen.queryByTestId("audio-project-header-share")).not.toBeInTheDocument()
	})
})
