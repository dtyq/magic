import { describe, expect, it, vi } from "vitest"
import type { ServiceHttpClient } from "@/infrastructure/network/http/clients"
import { generateMagicBaseApi, normalizeMagicBaseTable } from "../magicBase"

type MagicBaseHttpClientMock = Pick<ServiceHttpClient, "get" | "post" | "patch">

describe("MagicBaseApi", () => {
	it("normalizes large ids to strings", () => {
		const table = normalizeMagicBaseTable({
			id: "932694802891345920",
			project_id: 123,
			table_key: "mobile_survey",
			table_name: "Mobile Survey",
			status: "enabled",
			columns: [
				{
					id: "932694803314970624",
					table_id: "932694802891345920",
					column_key: "brand",
					column_name: "Brand",
					data_type: "text",
					is_required: false,
					status: "enabled",
				},
			],
		})

		expect(table.id).toBe("932694802891345920")
		expect(table.project_id).toBe("123")
		expect(table.columns[0].id).toBe("932694803314970624")
	})

	it("uses large integer parsing for list, detail, and row queries", async () => {
		const client: MagicBaseHttpClientMock = {
			get: vi.fn().mockResolvedValue([]),
			post: vi.fn().mockResolvedValue({ page: 1, page_size: 20, total: 0, list: [] }),
			patch: vi.fn().mockResolvedValue({ id: "row-1" }),
		}
		const api = generateMagicBaseApi(client as ServiceHttpClient)

		await api.getTables("project-1")
		await api.getTable("project-1", "table-1")
		await api.queryRows("project-1", "table-1", {
			select: "id,name",
			filter: {},
			sort: [{ field: "created_at", order: "desc" }],
			page: 1,
			page_size: 20,
		})

		expect(client.get).toHaveBeenNthCalledWith(
			1,
			"/api/v1/magicbase/projects/project-1/tables",
			{ parseJsonLargeIntAsString: true },
		)
		expect(client.get).toHaveBeenNthCalledWith(
			2,
			"/api/v1/magicbase/projects/project-1/tables/table-1",
			{ parseJsonLargeIntAsString: true },
		)
		expect(client.post).toHaveBeenCalledWith(
			"/api/v1/magicbase/projects/project-1/tables/table-1/query",
			{
				select: "id,name",
				filter: {},
				sort: [{ field: "created_at", order: "desc" }],
				page: 1,
				page_size: 20,
			},
			{ parseJsonLargeIntAsString: true },
		)
	})

	it("wraps row create, update, and batch delete endpoints", async () => {
		const client: MagicBaseHttpClientMock = {
			get: vi.fn(),
			post: vi.fn().mockResolvedValue({ id: "row-1" }),
			patch: vi.fn().mockResolvedValue({ id: "row-1" }),
		}
		const api = generateMagicBaseApi(client as ServiceHttpClient)

		await api.createRow("project-1", "table-1", {
			data: { brand: "Apple" },
			select: "id,brand",
		})
		await api.updateRow("project-1", "table-1", "row-1", {
			data: { brand: "Banana" },
			select: "id,brand",
		})
		await api.batchDeleteRows("project-1", "table-1", {
			record_ids: ["row-1", "row-2"],
		})

		expect(client.post).toHaveBeenNthCalledWith(
			1,
			"/api/v1/magicbase/projects/project-1/tables/table-1/rows",
			{ data: { brand: "Apple" }, select: "id,brand" },
			{ parseJsonLargeIntAsString: true },
		)
		expect(client.patch).toHaveBeenCalledWith(
			"/api/v1/magicbase/projects/project-1/tables/table-1/rows/row-1",
			{ data: { brand: "Banana" }, select: "id,brand" },
			{ parseJsonLargeIntAsString: true },
		)
		expect(client.post).toHaveBeenNthCalledWith(
			2,
			"/api/v1/magicbase/projects/project-1/tables/table-1/rows/batch-delete",
			{ record_ids: ["row-1", "row-2"] },
			{ parseJsonLargeIntAsString: true },
		)
	})

	it("updates the complete dynamic permission model through the table endpoint", async () => {
		const client: MagicBaseHttpClientMock = {
			get: vi.fn(),
			post: vi.fn(),
			patch: vi.fn().mockResolvedValue({
				id: "table-1",
				project_id: "project-1",
				table_key: "todos",
				table_name: "Todos",
				status: "enabled",
				columns: [],
			}),
		}
		const api = generateMagicBaseApi(client as ServiceHttpClient)
		const dynamicPermissions = {
			table: { read_scope: "public", insert_scope: "private_org" },
			row: {
				read_scope: "public",
				edit_scope: "private_user",
				delete_scope: "private_user",
			},
			columns: {
				title: { read_scope: "public", edit_scope: "private_user" },
			},
		}

		const table = await api.updateDynamicPermissions("project-1", "table-1", {
			dynamic_permissions: dynamicPermissions,
		})

		expect(client.patch).toHaveBeenCalledWith(
			"/api/v1/magicbase/projects/project-1/tables/table-1",
			{ dynamic_permissions: dynamicPermissions },
			{ parseJsonLargeIntAsString: true },
		)
		expect(table.id).toBe("table-1")
	})
})
