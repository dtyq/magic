import assert from "node:assert/strict"
import { beforeEach, describe, it } from "node:test"
import { buildApiUrl } from "@magic-admin-v2/api/api-url"
import { toAccountListQueryParams } from "../../../enterprise/src/features/platform-account-list/api.ts"
import {
	accountListAllValue,
	accountListPersonalOnlyValue,
	createDefaultAccountListFilterDraft,
	getAccountListFilterActiveCount,
	toAccountListParams,
} from "../../../enterprise/src/features/platform-account-list/filters.ts"
import { mockAccountApi, resetMockAccountStore } from "../../../enterprise/src/features/platform-account-list/mock.ts"
import {
	accountStatus,
	accountType,
} from "../../../enterprise/src/features/platform-account-list/types.ts"
import {
	getAccountStatusAction,
	pruneRowSelection,
} from "../../../enterprise/src/features/platform-account-list/utils.ts"

const firstAccountMagicId = "919500000000010001"

describe("platform account filters", () => {
	beforeEach(() => resetMockAccountStore())

	it("maps account filters to a trimmed first-page request", () => {
		assert.deepEqual(
			toAccountListParams({
				...createDefaultAccountListFilterDraft(),
				email: "  Acme-Magic.COM ",
				keyword: "  林悦  ",
				organizationScope: accountListPersonalOnlyValue,
				phone: " 1381 ",
				status: String(accountStatus.disabled),
			}),
			{
				account_type: accountType.human,
				email: "Acme-Magic.COM",
				keyword: "林悦",
				only_personal_organization: true,
				page: 1,
				page_size: 20,
				phone: "1381",
				status: accountStatus.disabled,
			},
		)
	})

	it("drops optional filters when the all option is selected", () => {
		const params = toAccountListParams({
			...createDefaultAccountListFilterDraft(),
			status: accountListAllValue,
		})

		assert.equal(params.status, undefined)
		assert.equal(params.only_personal_organization, undefined)
		assert.equal(params.keyword, undefined)
		assert.equal(params.email, undefined)
		assert.equal(params.phone, undefined)
		// 账号类型不作为筛选项，始终按人类账号查询。
		assert.equal(params.account_type, accountType.human)
	})

	it("counts each applied condition once", () => {
		assert.equal(getAccountListFilterActiveCount(createDefaultAccountListFilterDraft()), 0)
		assert.equal(
			getAccountListFilterActiveCount({
				...createDefaultAccountListFilterDraft(),
				email: "acme",
				keyword: "林悦",
				organizationScope: accountListPersonalOnlyValue,
				status: String(accountStatus.disabled),
			}),
			4,
		)
	})

	it("supports fuzzy keyword, phone and email search on the raw value", async () => {
		const byKeyword = await mockAccountApi.getList({
			keyword: "9195000000000100",
			page: 1,
			page_size: 100,
		})
		assert.ok(byKeyword.total > 1)

		const byNickname = await mockAccountApi.getList({
			keyword: "衡哥",
			page: 1,
			page_size: 100,
		})
		assert.equal(byNickname.total, 1)
		// 手机号脱敏返回，但筛选仍按完整值命中。
		assert.match(byNickname.list[0]?.phone ?? "", /\*\*\*\*/)

		const byPhone = await mockAccountApi.getList({
			page: 1,
			page_size: 100,
			phone: "13900001111",
		})
		assert.equal(byPhone.total, 1)

		const byEmail = await mockAccountApi.getList({
			email: "ACME-MAGIC",
			page: 1,
			page_size: 100,
		})
		assert.ok(byEmail.total > 1)
	})

	it("filters by account status, account type and organization scope", async () => {
		const disabled = await mockAccountApi.getList({
			page: 1,
			page_size: 100,
			status: accountStatus.disabled,
		})
		assert.ok(disabled.total > 0)
		assert.equal(
			disabled.list.every((account) => account.account_status === accountStatus.disabled),
			true,
		)

		const aiAccounts = await mockAccountApi.getList({
			account_type: accountType.ai,
			page: 1,
			page_size: 100,
		})
		assert.equal(aiAccounts.total, 1)
		assert.equal(aiAccounts.list[0]?.account_type, accountType.ai)

		const personalOnly = await mockAccountApi.getList({
			only_personal_organization: true,
			page: 1,
			page_size: 100,
		})
		assert.equal(
			personalOnly.list.every((account) => account.organization_count > 0),
			true,
		)
		assert.ok(personalOnly.total < (await mockAccountApi.getList({ page: 1, page_size: 100 })).total)
	})

	it("paginates with page metadata from the server", async () => {
		const firstPage = await mockAccountApi.getList({ page: 1, page_size: 5 })
		const secondPage = await mockAccountApi.getList({ page: 2, page_size: 5 })

		assert.equal(firstPage.list.length, 5)
		assert.equal(firstPage.page, 1)
		assert.equal(firstPage.page_size, 5)
		assert.equal(firstPage.total, secondPage.total)
		assert.notEqual(firstPage.list[0]?.magic_id, secondPage.list[0]?.magic_id)
	})

	it("disables and re-enables an account through the documented single-account endpoints", async () => {
		const before = await mockAccountApi.getStatusPreview(firstAccountMagicId)
		assert.equal(before.current_status, accountStatus.enabled)
		assert.equal(before.target_status, accountStatus.disabled)
		assert.ok(before.affected_organization_count > 0)

		const disabled = await mockAccountApi.disable({
			magic_id: firstAccountMagicId,
			reason: "脚本刷邀请积分",
		})
		assert.equal(disabled.changed, true)
		assert.equal(disabled.account_status, accountStatus.disabled)
		assert.ok((disabled.revocation?.api_keys ?? 0) > 0)

		const repeated = await mockAccountApi.disable({ magic_id: firstAccountMagicId })
		assert.equal(repeated.changed, false)
		assert.equal(repeated.already_disabled, true)
		assert.equal(repeated.revocation, undefined)

		const enabled = await mockAccountApi.enable({ magic_id: firstAccountMagicId })
		assert.equal(enabled.account_status, accountStatus.enabled)
		assert.equal(enabled.changed, true)

		const detail = await mockAccountApi.getDetail(firstAccountMagicId)
		assert.equal(detail.account.account_status, accountStatus.enabled)
	})

	it("refuses status changes for AI accounts and the protected creator", async () => {
		await assert.rejects(() => mockAccountApi.disable({ magic_id: "919500000000090001" }), {
			code: "17001",
		})
		await assert.rejects(() => mockAccountApi.disable({ magic_id: "919500000000000001" }), {
			code: "17004",
		})

		const protectedDetail = await mockAccountApi.getDetail("919500000000000001")
		assert.equal(protectedDetail.capabilities.protected, true)
		assert.equal(protectedDetail.capabilities.can_disable, false)
	})
})

describe("account list request serialization", () => {
	it("sends the personal-organization flag as 1/0 instead of true/false", () => {
		const withPersonal = buildApiUrl(
			"/accounts",
			undefined,
			toAccountListQueryParams({
				only_personal_organization: true,
				page: 1,
				page_size: 20,
			}),
		)

		assert.match(withPersonal, /only_personal_organization=1/)
		// 服务端布尔校验不接受字面量 true。
		assert.equal(withPersonal.includes("=true"), false)

		const withoutScope = buildApiUrl(
			"/accounts",
			undefined,
			toAccountListQueryParams({ page: 1, page_size: 20 }),
		)
		assert.equal(withoutScope.includes("only_personal_organization"), false)
	})
})

describe("account status row action", () => {
	it("offers exactly one status action per row", () => {
		const enabledAccount = {
			account_status: accountStatus.enabled,
			account_type: accountType.human,
			magic_id: "919500000000010001",
			organization_count: 0,
		}
		const disabledAccount = { ...enabledAccount, account_status: accountStatus.disabled }
		const aiAccount = { ...enabledAccount, account_type: accountType.ai }

		assert.equal(getAccountStatusAction(enabledAccount), "disable")
		assert.equal(getAccountStatusAction(disabledAccount), "enable")
		// AI 账号既不给禁用也不给解封。
		assert.equal(getAccountStatusAction(aiAccount), null)
	})
})

describe("account row selection", () => {	it("keeps only selections that are still visible on the current page", () => {
		assert.deepEqual(
			pruneRowSelection({ [firstAccountMagicId]: true, "919500000000010002": true }, [
				firstAccountMagicId,
			]),
			{ [firstAccountMagicId]: true },
		)
	})

	it("returns the original selection object when nothing changed", () => {
		const selection = { [firstAccountMagicId]: true }
		assert.equal(
			pruneRowSelection(selection, [firstAccountMagicId, "919500000000010003"]),
			selection,
		)
	})
})
