import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("@/apis", () => ({
	SuperMagicApi: {
		createFile: vi.fn(),
		saveFileContent: vi.fn(),
	},
}))

vi.mock("@/apis/modules/crew", () => ({
	buildCrewI18nText: (value = "") => ({ default: value }),
	normalizeCrewI18nArrayValue: (value?: string[]) => value?.join(", ") ?? "",
	resolveCrewIconUrl: () => "",
}))

vi.mock("@/services/crew/CrewService", () => ({
	crewService: {
		updateAgentInfo: vi.fn(),
		updateAgentBasicInfo: vi.fn(),
	},
}))

vi.mock("@/services/crew/agent-prompt", () => ({
	encodeCrewAgentPrompt: (value: string) => value,
	resolveCrewAgentPromptText: (value: string | null) => value,
}))

function createStore({
	flatList = [],
	tree = [],
	projectId,
}: {
	flatList?: Array<Record<string, unknown>>
	tree?: Array<Record<string, unknown>>
	projectId?: string
} = {}) {
	return import("../identity-store").then(
		({ CrewIdentityStore }) =>
			new CrewIdentityStore({
				getCrewCode: () => null,
				setCrewCode: () => undefined,
				getProjectId: () => projectId,
				getWorkspaceFilesList: () => flatList as never[],
				getWorkspaceFileTree: () => tree as never[],
			}),
	)
}

describe("CrewIdentityStore", () => {
	beforeEach(() => {
		vi.clearAllMocks()
	})

	it("creates root .magic instead of reusing nested .magic directory", async () => {
		const { SuperMagicApi } = await import("@/apis")
		vi.mocked(SuperMagicApi.createFile)
			.mockResolvedValueOnce({ file_id: "root-magic" } as never)
			.mockResolvedValueOnce({ file_id: "identity-file" } as never)
		vi.mocked(SuperMagicApi.saveFileContent).mockResolvedValue(undefined as never)

		const store = await createStore({
			flatList: [
				{
					file_id: "nested-magic",
					is_directory: true,
					relative_file_path: "foo/.magic",
					source: 0,
				},
			],
		})

		const result = await store.ensureIdentityMarkdownFile({
			projectId: "project-1",
			name_i18n: { default: "Crew" },
			role_i18n: {},
			description_i18n: { default: "Description" },
		})

		expect(result).toBe(true)
		expect(SuperMagicApi.createFile).toHaveBeenNthCalledWith(1, {
			project_id: "project-1",
			parent_id: "",
			file_name: ".magic",
			is_directory: true,
		})
		expect(SuperMagicApi.createFile).toHaveBeenNthCalledWith(2, {
			project_id: "project-1",
			parent_id: "root-magic",
			file_name: "IDENTITY.md",
			is_directory: false,
		})
	})

	it("creates identity markdown before saving name and description", async () => {
		const { SuperMagicApi } = await import("@/apis")
		vi.mocked(SuperMagicApi.createFile)
			.mockResolvedValueOnce({ file_id: "root-magic" } as never)
			.mockResolvedValueOnce({ file_id: "identity-file" } as never)
		vi.mocked(SuperMagicApi.saveFileContent).mockResolvedValue(undefined as never)

		const store = await createStore({ projectId: "project-1" })

		const result = await store.saveNameAndDescriptionToIdentityMarkdown({
			name: "Crew",
			description: "Description",
		})

		expect(result).toBe(true)
		expect(SuperMagicApi.createFile).toHaveBeenCalledTimes(2)
		expect(SuperMagicApi.saveFileContent).toHaveBeenCalledTimes(2)
	})

	it("creates identity markdown before syncing i18n fields", async () => {
		const { SuperMagicApi } = await import("@/apis")
		vi.mocked(SuperMagicApi.createFile)
			.mockResolvedValueOnce({ file_id: "root-magic" } as never)
			.mockResolvedValueOnce({ file_id: "identity-file" } as never)
		vi.mocked(SuperMagicApi.saveFileContent).mockResolvedValue(undefined as never)

		const store = await createStore({ projectId: "project-1" })

		const result = await store.syncI18nFieldsToIdentityMarkdown({
			name_i18n: { default: "Crew", en_US: "Crew EN", zh_CN: "团队" },
			role_i18n: { default: ["Role"] },
			description_i18n: { default: "Description" },
		})

		expect(result).toBe(true)
		expect(SuperMagicApi.createFile).toHaveBeenCalledTimes(2)
		expect(SuperMagicApi.saveFileContent).toHaveBeenCalledTimes(2)
	})
})
