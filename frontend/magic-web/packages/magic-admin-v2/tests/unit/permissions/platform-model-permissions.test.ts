import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { describe, it } from "node:test"
import { PERMISSION_KEY_MAP } from "@magic-admin-v2/constants/permissions"
import {
	getAccessibleProviderModelCategories,
	getEditableProviderModelCategories,
	getProviderModelAccessCategory,
	getProviderModelCategoryAccess,
	providerModelCategoryOrder,
	toProviderModelApiCategories,
} from "@magic-admin-v2/features/platform-model-list/utils/permissions"
import {
	providerModelCategory,
	providerModelType,
} from "@magic-admin-v2/features/platform-model-list/types"
import type { AccessContext } from "@magic-admin-v2/runtime/types"

const modelListPageSource = readFileSync(
	"src/features/platform-model-list/platform-model-list-page.tsx",
	"utf8",
)
const modelEditorSource = readFileSync(
	"src/features/platform-model-list/components/model-editor-common-tab.tsx",
	"utf8",
)

function createAccess(magicPermissionKeys: readonly string[]): AccessContext {
	return {
		organizationCode: "organization-code",
		hasTeamshareAllPermissions: false,
		isOfficialOrganization: true,
		isPersonalOrganization: false,
		magicPermissionKeys,
		teamsharePermissionKeys: [],
		user: {
			id: "user-id",
			name: "User",
		},
		organization: {
			organizationCode: "organization-code",
			name: "Organization",
		},
	}
}

describe("platform model category permissions", () => {
	it("keeps the unified platform query permission read-only for every category", () => {
		const access = getProviderModelCategoryAccess(
			createAccess([PERMISSION_KEY_MAP.PLATFORM_MODEL_MANAGEMENT_QUERY]),
			"platform",
		)

		assert.deepEqual(getAccessibleProviderModelCategories(access), [
			providerModelCategory.llm,
			providerModelCategory.vlm,
			providerModelCategory.vgm,
			providerModelCategory.embedding,
		])
		assert.deepEqual(getEditableProviderModelCategories(access), [])
		assert.equal(access[providerModelCategory.llm].canView, true)
		assert.equal(access[providerModelCategory.llm].canEdit, false)
		assert.equal(access[providerModelCategory.embedding].canView, true)
		assert.equal(access[providerModelCategory.embedding].canEdit, false)
	})

	it("lets the unified platform edit permission edit every category", () => {
		const access = getProviderModelCategoryAccess(
			createAccess([PERMISSION_KEY_MAP.PLATFORM_MODEL_MANAGEMENT_EDIT]),
			"platform",
		)

		assert.deepEqual(getAccessibleProviderModelCategories(access), providerModelCategoryOrder)
		assert.deepEqual(getEditableProviderModelCategories(access), providerModelCategoryOrder)
	})

	it("lets platform-wide permission cover every platform category", () => {
		const access = getProviderModelCategoryAccess(
			createAccess([PERMISSION_KEY_MAP.MAGIC_PLATFORM_PERMISSIONS]),
			"platform",
		)

		assert.equal(getAccessibleProviderModelCategories(access).length, 4)
		assert.equal(getEditableProviderModelCategories(access).length, 4)
	})

	it("maps embedding requests to the text API category without duplicates", () => {
		assert.deepEqual(
			toProviderModelApiCategories([
				providerModelCategory.llm,
				providerModelCategory.embedding,
				providerModelCategory.vlm,
			]),
			[providerModelCategory.llm, providerModelCategory.vlm],
		)
	})

	it("checks embedding rows against text and embedding access", () => {
		assert.equal(
			getProviderModelAccessCategory({
				category: providerModelCategory.llm,
				model_type: providerModelType.embedding,
			}),
			providerModelCategory.embedding,
		)
	})

	it("applies category and read-only permissions to the page and editor", () => {
		assert.equal(modelListPageSource.includes("categories={accessibleCategories}"), true)
		assert.equal(modelListPageSource.includes("enabled: hasViewAccess"), true)
		assert.equal(modelListPageSource.includes("allowedCategories={editableCategories}"), true)
		assert.equal(modelListPageSource.includes("rowCanEdit"), true)
		assert.equal(modelListPageSource.includes("canCreateModel"), true)
		assert.equal(modelListPageSource.includes("restrictQueryParamsToAccess"), true)
		assert.equal(
			modelListPageSource.includes("useProviderModelGroupsQuery(permissionSafeParams"),
			true,
		)
		assert.equal(modelEditorSource.includes("selectableCategories.map"), true)
	})
})
