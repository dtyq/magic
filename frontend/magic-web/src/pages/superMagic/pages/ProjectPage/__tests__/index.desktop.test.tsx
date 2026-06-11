import { render } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import ProjectPage from "../index.desktop"

const pubsubMock = vi.hoisted(() => ({
	subscribe: vi.fn(),
	unsubscribe: vi.fn(),
	publish: vi.fn(),
}))

vi.mock("@/utils/pubsub", () => ({
	default: pubsubMock,
	PubSubEvents: {
		Update_Active_File_Id: "update_active_file_id",
		Open_File_Tab: "open_file_tab",
		Open_Playback_Tab: "open_playback_tab",
		Open_Knowledge_Base_Tab: "open_knowledge_base_tab",
		Update_Attachments_Loading: "update_attachments_loading",
		Update_Attachments: "update_attachments",
		Super_Magic_Update_Auto_Detail: "super_magic_update_auto_detail",
	},
}))

vi.mock("mobx-react-lite", () => ({
	observer: (component: unknown) => component,
}))

vi.mock("react-i18next", () => ({
	useTranslation: () => ({ t: (key: string) => key }),
}))

vi.mock("ahooks", async () => {
	const React = await import("react")
	return {
		useDeepCompareEffect: React.useEffect,
		useUpdateEffect: React.useEffect,
		useMemoizedFn: (fn: unknown) => fn,
		useDebounceFn: (fn: unknown) => ({ run: fn }),
	}
})

vi.mock("@/pages/superMagic/pages/Workspace/style", () => ({
	default: () => ({
		styles: {
			container: "container",
			detailPanel: "detail-panel",
		},
	}),
}))

vi.mock("@/pages/superMagic/components/Detail", async () => {
	const React = await import("react")
	return {
		default: React.forwardRef((_props, ref) => {
			React.useImperativeHandle(ref, () => ({
				openFileTab: vi.fn(),
				openPlaybackTab: vi.fn(),
				openKnowledgeBaseTab: vi.fn(),
			}))
			return <div data-testid="detail" />
		}),
	}
})

vi.mock("@/pages/superMagic/components/TopicFilesButton", () => ({
	default: () => <div data-testid="topic-files" />,
}))

vi.mock("@/components/business/MentionPanel/builtin-store", () => ({
	default: {
		initLoadAttachments: vi.fn(),
		clearInitLoadAttachmentsPromise: vi.fn(),
		finishLoadAttachmentsPromise: vi.fn(),
	},
}))

vi.mock("@/stores/projectFiles", () => ({
	default: {
		setWorkspaceFileTree: vi.fn(),
	},
}))

vi.mock("@/pages/superMagic/components/ProjectSider", () => ({
	default: () => <div data-testid="project-sider" />,
}))

vi.mock("@/pages/superMagic/hooks/useDetailModeCache", () => ({
	useDetailModeCache: vi.fn(),
}))

vi.mock("@/pages/superMagic/hooks/useAttachmentsPolling", () => ({
	useAttachmentsPolling: vi.fn(),
}))

vi.mock("@/pages/superMagic/utils/attachmentDataProcessor", () => ({
	AttachmentDataProcessor: {
		processAttachmentData: vi.fn(() => ({ tree: [], list: [] })),
	},
}))

vi.mock("@/pages/superMagic/services/attachmentsTopicSync", () => ({
	releaseAttachmentsRefreshWaitersWithoutFetch: vi.fn(),
	resolveAttachmentsRefreshWaitersForProject: vi.fn(),
	withAttachmentsRefreshWaitersResolved: vi.fn((_projectId, promise) => promise),
}))

vi.mock("@/pages/superMagic/constants", () => ({
	isCollaborationWorkspace: vi.fn(() => false),
}))

vi.mock("@/pages/superMagic/hooks/useNoPermissionCollaborationProject", () => ({
	useNoPermissionCollaborationProject: () => ({
		handleNoPermissionCollaborationProject: vi.fn(),
	}),
}))

vi.mock("@/apis", () => ({
	SuperMagicApi: {
		getAttachmentsByProjectId: vi.fn(),
	},
}))

vi.mock("@/pages/superMagic/stores/core", () => ({
	workspaceStore: {
		selectedWorkspace: null,
	},
	projectStore: {
		selectedProject: null,
	},
	topicStore: {
		selectedTopic: null,
	},
}))

vi.mock("@/pages/superMagic/components/ProjectCardContainer", () => ({
	default: () => <div data-testid="project-card" />,
}))

vi.mock("@/pages/superMagic/pages/TopicPage/components/TopicDesktopPanels", () => ({
	default: () => <div data-testid="topic-desktop-panels" />,
}))

vi.mock("@/pages/superMagic/pages/AudioRecordings/utils/is-audio-project-mode", () => ({
	isAudioProjectMode: vi.fn(() => false),
}))

describe("ProjectPage desktop", () => {
	it("unsubscribes open-tab events with their exact handlers", () => {
		pubsubMock.subscribe.mockClear()
		pubsubMock.unsubscribe.mockClear()

		const { unmount } = render(<ProjectPage />)
		unmount()

		for (const eventName of ["open_file_tab", "open_playback_tab", "open_knowledge_base_tab"]) {
			const subscribeCall = pubsubMock.subscribe.mock.calls.find(
				([event]) => event === eventName,
			)
			expect(subscribeCall).toBeDefined()
			const handler = subscribeCall?.[1]
			expect(typeof handler).toBe("function")
			expect(pubsubMock.unsubscribe).toHaveBeenCalledWith(eventName, handler)
		}
	})
})
