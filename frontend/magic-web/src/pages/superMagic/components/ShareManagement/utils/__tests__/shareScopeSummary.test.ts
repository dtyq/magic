import { describe, expect, it } from "vitest"
import {
	formatOrganizationShareScopeSummary,
	isOrganizationShareScopeAll,
} from "../shareScopeSummary"

function createTranslator() {
	const labels: Record<string, string> = {
		"projectShare.shareScopeAllMembers": "所有成员",
		"projectShare.manageOrganizationMembersAndDepartments": "{{userCount}} members, {{departmentCount}} departments",
		"projectShare.manageOrganizationMembersOnly": "{{userCount}} members",
		"projectShare.manageOrganizationDepartmentsOnly": "{{departmentCount}} departments",
		"projectShare.manageOrganizationSummary": "Organization members can access",
	}

	return (key: string, values?: Record<string, unknown>) => {
		let text = labels[key] || key
		if (values) {
			Object.entries(values).forEach(([name, value]) => {
				text = text.replace(`{{${name}}}`, String(value))
			})
		}
		return text
	}
}

describe("isOrganizationShareScopeAll", () => {
	it("returns true when type is all", () => {
		expect(isOrganizationShareScopeAll({ type: "all" })).toBe(true)
	})

	it("returns false for designated or missing type", () => {
		expect(isOrganizationShareScopeAll({ type: "designated" })).toBe(false)
		expect(isOrganizationShareScopeAll(undefined)).toBe(false)
	})
})

describe("formatOrganizationShareScopeSummary", () => {
	const t = createTranslator()

	it("shows all-members copy when type is all", () => {
		expect(
			formatOrganizationShareScopeSummary({ type: "all", user_count: 5, department_count: 2 }, t),
		).toBe("所有成员")
	})

	it("shows member and department counts for designated scope", () => {
		expect(
			formatOrganizationShareScopeSummary(
				{ type: "designated", user_count: 3, department_count: 2 },
				t,
			),
		).toBe("3 members, 2 departments")
	})

	it("shows members only when only user_count is set", () => {
		expect(formatOrganizationShareScopeSummary({ user_count: 4 }, t)).toBe("4 members")
	})

	it("shows departments only when only department_count is set", () => {
		expect(formatOrganizationShareScopeSummary({ department_count: 1 }, t)).toBe("1 departments")
	})

	it("falls back to organization summary when counts are zero", () => {
		expect(formatOrganizationShareScopeSummary({ type: "designated" }, t)).toBe(
			"Organization members can access",
		)
	})
})
