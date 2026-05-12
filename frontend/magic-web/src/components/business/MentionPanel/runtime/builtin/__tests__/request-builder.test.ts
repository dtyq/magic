import { describe, expect, it } from "vitest"
import { MentionPanelCatalogId, MentionPanelState as PanelState } from "../../../businessTypes"
import { buildMentionStoreRequest } from "../request-builder"

describe("buildMentionStoreRequest", () => {
	it("should build default request", () => {
		const request = buildMentionStoreRequest({
			state: PanelState.DEFAULT,
			t: {
				projectFiles: "Project Files",
			} as never,
		})

		expect(request).toEqual({
			kind: "default",
			options: {
				t: {
					projectFiles: "Project Files",
				},
			},
		})
	})

	it("should return null for empty search query", () => {
		const request = buildMentionStoreRequest({
			state: PanelState.SEARCH,
			query: "   ",
		})

		expect(request).toBeNull()
	})

	it("should build search request", () => {
		const request = buildMentionStoreRequest({
			state: PanelState.SEARCH,
			query: "magic",
		})

		expect(request).toEqual({
			kind: "search",
			query: "magic",
		})
	})

	it("should build search request with scope folder id", () => {
		const request = buildMentionStoreRequest({
			state: PanelState.SEARCH,
			query: "magic",
			scopeFolderId: "folder-1",
		})

		expect(request).toEqual({
			kind: "search",
			query: "magic",
			scopeFolderId: "folder-1",
		})
	})

	it("should require folder id for folder state", () => {
		const request = buildMentionStoreRequest({
			state: PanelState.FOLDER,
		})

		expect(request).toBeNull()
	})

	it("should build children request for folder state", () => {
		const request = buildMentionStoreRequest({
			state: PanelState.FOLDER,
			itemId: "folder-id",
		})

		expect(request).toEqual({
			kind: "children",
			id: "folder-id",
		})
	})

	it("should build refreshable catalog request for skills", () => {
		const request = buildMentionStoreRequest({
			state: PanelState.CATALOG,
			catalogId: MentionPanelCatalogId.SKILLS,
		})

		expect(request).toEqual({
			kind: "catalog",
			catalogId: MentionPanelCatalogId.SKILLS,
			options: {
				refresh: true,
			},
		})
	})

	it("should require item id for tools", () => {
		const request = buildMentionStoreRequest({
			state: PanelState.CATALOG,
			catalogId: MentionPanelCatalogId.TOOLS,
		})

		expect(request).toBeNull()
	})

	it("should build catalog request for tools", () => {
		const request = buildMentionStoreRequest({
			state: PanelState.CATALOG,
			catalogId: MentionPanelCatalogId.TOOLS,
			itemId: "tools",
		})

		expect(request).toEqual({
			kind: "catalog",
			catalogId: MentionPanelCatalogId.TOOLS,
			id: "tools",
		})
	})

	it.each([
		MentionPanelCatalogId.UPLOAD_FILES,
		MentionPanelCatalogId.MCP_EXTENSIONS,
		MentionPanelCatalogId.AGENTS,
		MentionPanelCatalogId.HISTORIES,
		MentionPanelCatalogId.TABS,
	])("should build plain catalog request for %s", (catalogId) => {
		const request = buildMentionStoreRequest({
			state: PanelState.CATALOG,
			catalogId,
		})

		expect(request).toEqual({
			kind: "catalog",
			catalogId,
		})
	})
})
