import { beforeEach, describe, expect, it } from "vitest"
import { SidebarStore } from "../SidebarStore"

describe("Sidebar navigation preferences", () => {
	beforeEach(() => localStorage.clear())

	it("restores recent for the same identity and isolates other organizations", () => {
		const store = new SidebarStore()
		store.setNavigationIdentity("user", "organization-a")
		store.selectNavigationSection("recent")
		expect(store.recentProjectsExpanded).toBe(true)
		expect(store.workspacesExpanded).toBe(false)
		store.setNavigationIdentity("user", "organization-b")
		expect(store.expandedNavigationSection).toBe("workspaces")
		store.setNavigationIdentity("user", "organization-a")
		expect(store.expandedNavigationSection).toBe("recent")
	})

	it("falls back to spaces for a saved chats tab", () => {
		localStorage.setItem(
			'sidebar-navigation:["user","organization"]',
			JSON.stringify({ expandedSection: "chats" }),
		)
		const store = new SidebarStore()
		store.setNavigationIdentity("user", "organization")
		expect(store.workspacesExpanded).toBe(true)
	})

	it.each(["recent", "workspaces"] as const)(
		"keeps the existing %s preference compatible",
		(section) => {
			const store = new SidebarStore()
			store.setNavigationIdentity("user", "organization")
			store.selectNavigationSection(section)
			store.selectNavigationSection(section === "recent" ? "workspaces" : "recent")
			store.selectNavigationSection(section)
			expect(store.expandedNavigationSection).toBe(section)
		},
	)
})
