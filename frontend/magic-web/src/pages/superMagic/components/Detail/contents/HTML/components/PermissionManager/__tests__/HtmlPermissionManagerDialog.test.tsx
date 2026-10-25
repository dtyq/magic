import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import type { HtmlPermissionSnapshot } from "../../../iframe-api/services/IframePermissionService"
import HtmlPermissionManagerDialog, {
	createHtmlPermissionDateFormatter,
} from "../HtmlPermissionManagerDialog"
import { formatRemaining } from "../HtmlPermissionItem"

vi.mock("react-i18next", () => {
	const t = (key: string) => key
	const i18n = { language: "zh_CN" }
	return { useTranslation: () => ({ t, i18n }) }
})

vi.mock("@/components/base/MagicToaster/utils", () => ({
	default: { success: vi.fn(), error: vi.fn() },
}))

Object.defineProperty(Element.prototype, "scrollIntoView", {
	configurable: true,
	value: vi.fn(),
})

const activeGrant = {
	mode: "manifest" as const,
	userId: "user-1",
	projectId: "project-1",
	appRootDir: "apps/demo/",
	entryPath: "apps/demo/index.html",
	appFingerprint: "fingerprint",
	scope: "llm.use" as const,
	grantedAt: Date.now() - 60_000,
	expiresAt: Date.now() - 60_000 + 60 * 60 * 1000,
}

function createSnapshot(active = true): HtmlPermissionSnapshot {
	return {
		configStatus: "loaded",
		mode: "manifest",
		app: {
			name: "Demo App",
			version: "1.0.0",
			entry: "index.html",
			appRootDir: "apps/demo/",
			reason: "Analyze content",
		},
		permissions: [
			{
				scope: "llm.use",
				supported: true,
				declarationStatus: "declared",
				grant: active ? activeGrant : undefined,
				highRisk: true,
				codeStatus: "same",
				needsReconfirm: false,
				ttlOptions: [
					{ labelKey: "ttl.1h", ttlMs: 60 * 60 * 1000 },
					{ labelKey: "ttl.1d", ttlMs: 24 * 60 * 60 * 1000 },
					{ labelKey: "ttl.7d", ttlMs: 7 * 24 * 60 * 60 * 1000 },
				],
			},
			{
				scope: "project.message.write",
				supported: true,
				declarationStatus: "notDeclared",
				highRisk: true,
				codeStatus: "same",
				needsReconfirm: false,
				ttlOptions: [],
			},
			{
				scope: "future.scope",
				supported: false,
				declarationStatus: "unsupported",
				highRisk: false,
				codeStatus: "same",
				needsReconfirm: false,
				ttlOptions: [],
			},
		],
		diagnostics: [{ code: "scopeUnsupported", scope: "future.scope" }],
		activeGrantCount: active ? 1 : 0,
		codeChangedGrantCount: 0,
		needsReconfirmCount: 0,
	}
}

describe("HtmlPermissionManagerDialog", () => {
	it("normalizes underscore locale tags before formatting dates", () => {
		const formatter = createHtmlPermissionDateFormatter("zh_CN")
		expect(() => formatter.format(Date.now())).not.toThrow()
		expect(formatter.resolvedOptions().timeZoneName).toBeUndefined()
		expect(formatter.resolvedOptions().second).toBeUndefined()
	})

	it("formats long remaining durations in days", () => {
		expect(formatRemaining(7 * 24 * 60 * 60 * 1000, ((key: string) => key) as never)).toBe(
			"htmlEditor.permissionManager.remainingDays",
		)
	})

	it("renders app metadata and only registered declared permissions", async () => {
		render(
			<HtmlPermissionManagerDialog
				open
				onOpenChange={vi.fn()}
				permissionRevision={0}
				getPermissionSnapshot={vi.fn().mockResolvedValue(createSnapshot())}
				onAuthorize={vi.fn().mockResolvedValue(true)}
				onRevoke={vi.fn().mockResolvedValue(createSnapshot(false))}
				onUpdateTtl={vi.fn().mockResolvedValue(createSnapshot())}
				onRevokeAll={vi.fn().mockResolvedValue(createSnapshot(false))}
			/>,
		)

		expect(await screen.findByText("Demo App")).toBeInTheDocument()
		expect(
			screen.getByText("htmlEditor.permissionAuthorizationConfirm.scopes.llmUse"),
		).toBeInTheDocument()
		expect(screen.queryByText("htmlEditor.permissionManager.declared")).not.toBeInTheDocument()
		expect(screen.queryByText("llm.use")).not.toBeInTheDocument()
		expect(screen.queryByText("future.scope")).not.toBeInTheDocument()
		expect(
			screen.queryByText("htmlEditor.permissionManager.diagnostics.scopeUnsupported"),
		).not.toBeInTheDocument()
		expect(screen.queryByText("project.message.write")).not.toBeInTheDocument()
		const dialog = screen.getByTestId("html-permission-manager-dialog")
		expect(dialog.className).toContain("w-[min(880px,calc(100vw-2rem))]")
		expect(dialog.className).toContain("h-[min(800px,90dvh)]")
		expect(dialog.className).toContain("grid-rows-[auto_minmax(0,1fr)_auto]")
		expect(screen.getByTestId("html-permission-manager-scroll-area").className).toContain(
			"scroll-area-thumb",
		)
		expect(screen.getByTestId("html-permission-manager-footer").className).toContain("shrink-0")
		expect(screen.queryByTestId("html-permission-manager-revoke-note")).not.toBeInTheDocument()

		fireEvent.focus(screen.getByRole("button", { name: "htmlEditor.permissionManager.revoke" }))
		expect(
			await screen.findAllByText("htmlEditor.permissionManager.revokeNoteTitle"),
		).not.toHaveLength(0)
		expect(screen.getAllByText("htmlEditor.permissionManager.revokeNote")).not.toHaveLength(0)
		expect(document.querySelector('[data-slot="tooltip-content"]')).toHaveClass("text-wrap")
	})

	it("renders only active grants for legacy apps", async () => {
		const snapshot = createSnapshot()
		snapshot.configStatus = "absent"
		snapshot.mode = "legacy"
		snapshot.permissions = [
			{
				...snapshot.permissions[0],
				declarationStatus: "notDeclared",
				grant: { ...activeGrant, mode: "legacy" },
			},
			{
				...snapshot.permissions[1],
				grant: undefined,
			},
		]

		render(
			<HtmlPermissionManagerDialog
				open
				onOpenChange={vi.fn()}
				permissionRevision={0}
				getPermissionSnapshot={vi.fn().mockResolvedValue(snapshot)}
				onAuthorize={vi.fn().mockResolvedValue(true)}
				onRevoke={vi.fn().mockResolvedValue(snapshot)}
				onUpdateTtl={vi.fn().mockResolvedValue(snapshot)}
				onRevokeAll={vi.fn().mockResolvedValue(snapshot)}
			/>,
		)

		expect(
			await screen.findByText("htmlEditor.permissionAuthorizationConfirm.scopes.llmUse"),
		).toBeInTheDocument()
		expect(screen.queryByText("project.message.write")).not.toBeInTheDocument()
	})

	it("uses the application select layer inside the permission dialog", async () => {
		render(
			<HtmlPermissionManagerDialog
				open
				onOpenChange={vi.fn()}
				permissionRevision={0}
				getPermissionSnapshot={vi.fn().mockResolvedValue(createSnapshot())}
				onAuthorize={vi.fn().mockResolvedValue(true)}
				onRevoke={vi.fn().mockResolvedValue(createSnapshot(false))}
				onUpdateTtl={vi.fn().mockResolvedValue(createSnapshot())}
				onRevokeAll={vi.fn().mockResolvedValue(createSnapshot(false))}
			/>,
		)

		fireEvent.click(
			await screen.findByRole("combobox", {
				name: "htmlEditor.permissionManager.durationSelect",
			}),
		)
		const selectContent = document.querySelector('[data-slot="select-content"]')

		expect(selectContent).toHaveClass("z-select")
		expect(selectContent).not.toHaveClass("!z-[950]")
	})

	it("hides revoke-all action and keeps diagnostics in one content column without grants", async () => {
		const snapshot = createSnapshot(false)
		snapshot.configStatus = "absent"
		snapshot.mode = "legacy"
		snapshot.permissions = []
		snapshot.diagnostics = [{ code: "manifestAbsent" }]

		render(
			<HtmlPermissionManagerDialog
				open
				onOpenChange={vi.fn()}
				permissionRevision={0}
				getPermissionSnapshot={vi.fn().mockResolvedValue(snapshot)}
				onAuthorize={vi.fn().mockResolvedValue(true)}
				onRevoke={vi.fn().mockResolvedValue(snapshot)}
				onUpdateTtl={vi.fn().mockResolvedValue(snapshot)}
				onRevokeAll={vi.fn().mockResolvedValue(snapshot)}
			/>,
		)

		expect(
			await screen.findByText("htmlEditor.permissionManager.diagnostics.manifestAbsent"),
		).toBeInTheDocument()
		expect(
			screen.queryByRole("button", { name: "htmlEditor.permissionManager.revokeAll" }),
		).not.toBeInTheDocument()

		const diagnosticsTitle = screen.getByText("htmlEditor.permissionManager.diagnosticsTitle")
		expect(diagnosticsTitle.parentElement).not.toBe(screen.getByRole("alert"))
	})

	it("authorizes a declared permission before the app uses it", async () => {
		const onAuthorize = vi.fn().mockResolvedValue(true)
		const getPermissionSnapshot = vi
			.fn()
			.mockResolvedValueOnce(createSnapshot(false))
			.mockResolvedValue(createSnapshot(true))
		render(
			<HtmlPermissionManagerDialog
				open
				onOpenChange={vi.fn()}
				permissionRevision={0}
				getPermissionSnapshot={getPermissionSnapshot}
				onAuthorize={onAuthorize}
				onRevoke={vi.fn().mockResolvedValue(createSnapshot(false))}
				onUpdateTtl={vi.fn().mockResolvedValue(createSnapshot())}
				onRevokeAll={vi.fn().mockResolvedValue(createSnapshot(false))}
			/>,
		)

		fireEvent.click(
			await screen.findByRole("button", { name: "htmlEditor.permissionManager.authorize" }),
		)

		await waitFor(() => expect(onAuthorize).toHaveBeenCalledWith("llm.use"))
		expect(await screen.findByText("htmlEditor.permissionManager.granted")).toBeInTheDocument()
	})

	it("revokes an active grant and refreshes the row immediately", async () => {
		const onRevoke = vi.fn().mockResolvedValue(createSnapshot(false))
		render(
			<HtmlPermissionManagerDialog
				open
				onOpenChange={vi.fn()}
				permissionRevision={0}
				getPermissionSnapshot={vi.fn().mockResolvedValue(createSnapshot())}
				onAuthorize={vi.fn().mockResolvedValue(true)}
				onRevoke={onRevoke}
				onUpdateTtl={vi.fn().mockResolvedValue(createSnapshot())}
				onRevokeAll={vi.fn().mockResolvedValue(createSnapshot(false))}
			/>,
		)

		fireEvent.click(
			await screen.findByRole("button", { name: "htmlEditor.permissionManager.revoke" }),
		)

		await waitFor(() => expect(onRevoke).toHaveBeenCalledWith("llm.use"))
		expect(screen.getByText("htmlEditor.permissionManager.askWhenUsed")).toBeInTheDocument()
	})

	it("updates the selected authorization duration", async () => {
		const onUpdateTtl = vi.fn().mockResolvedValue(createSnapshot())
		render(
			<HtmlPermissionManagerDialog
				open
				onOpenChange={vi.fn()}
				permissionRevision={0}
				getPermissionSnapshot={vi.fn().mockResolvedValue(createSnapshot())}
				onAuthorize={vi.fn().mockResolvedValue(true)}
				onRevoke={vi.fn().mockResolvedValue(createSnapshot(false))}
				onUpdateTtl={onUpdateTtl}
				onRevokeAll={vi.fn().mockResolvedValue(createSnapshot(false))}
			/>,
		)

		const durationSelect = await screen.findByRole("combobox", {
			name: "htmlEditor.permissionManager.durationSelect",
		})
		fireEvent.click(durationSelect)
		fireEvent.click(
			await screen.findByRole("option", {
				name: "htmlEditor.permissionAuthorizationConfirm.ttl.7d",
			}),
		)
		fireEvent.click(
			screen.getByRole("button", { name: "htmlEditor.permissionManager.updateDuration" }),
		)

		await waitFor(() =>
			expect(onUpdateTtl).toHaveBeenCalledWith("llm.use", 7 * 24 * 60 * 60 * 1000),
		)
	})

	it("renders and updates an always-valid authorization", async () => {
		const snapshot = createSnapshot()
		snapshot.permissions[0] = {
			scope: "user.profile.name",
			supported: true,
			declarationStatus: "declared",
			grant: {
				...activeGrant,
				scope: "user.profile.name",
				expiresAt: null,
			},
			ttlOptions: [
				{ labelKey: "ttl.1d", ttlMs: 24 * 60 * 60 * 1000 },
				{ labelKey: "ttl.7d", ttlMs: 7 * 24 * 60 * 60 * 1000 },
				{ labelKey: "ttl.30d", ttlMs: 30 * 24 * 60 * 60 * 1000 },
				{ labelKey: "ttl.always", ttlMs: null },
			],
		}
		const onUpdateTtl = vi.fn().mockResolvedValue(snapshot)
		render(
			<HtmlPermissionManagerDialog
				open
				onOpenChange={vi.fn()}
				permissionRevision={0}
				getPermissionSnapshot={vi.fn().mockResolvedValue(snapshot)}
				onAuthorize={vi.fn().mockResolvedValue(true)}
				onRevoke={vi.fn().mockResolvedValue(createSnapshot(false))}
				onUpdateTtl={onUpdateTtl}
				onRevokeAll={vi.fn().mockResolvedValue(createSnapshot(false))}
			/>,
		)

		expect(
			await screen.findByText("htmlEditor.permissionManager.alwaysValid"),
		).toBeInTheDocument()
		fireEvent.click(
			screen.getByRole("combobox", { name: "htmlEditor.permissionManager.durationSelect" }),
		)
		fireEvent.click(
			await screen.findByRole("option", {
				name: "htmlEditor.permissionAuthorizationConfirm.ttl.1d",
			}),
		)
		fireEvent.click(
			screen.getByRole("button", { name: "htmlEditor.permissionManager.updateDuration" }),
		)

		await waitFor(() =>
			expect(onUpdateTtl).toHaveBeenCalledWith("user.profile.name", 24 * 60 * 60 * 1000),
		)
	})

	function renderDialog(snapshot: HtmlPermissionSnapshot, overrides = {}) {
		return render(
			<HtmlPermissionManagerDialog
				open
				onOpenChange={vi.fn()}
				permissionRevision={0}
				getPermissionSnapshot={vi.fn().mockResolvedValue(snapshot)}
				onAuthorize={vi.fn().mockResolvedValue(true)}
				onRevoke={vi.fn().mockResolvedValue(snapshot)}
				onUpdateTtl={vi.fn().mockResolvedValue(snapshot)}
				onRevokeAll={vi.fn().mockResolvedValue(createSnapshot(false))}
				onAcknowledgeCodeChanges={vi.fn().mockResolvedValue(createSnapshot())}
				{...overrides}
			/>,
		)
	}

	it("shows no code-change reminder while the code matches the confirmed version", async () => {
		renderDialog(createSnapshot())

		expect(await screen.findByText("Demo App")).toBeInTheDocument()
		expect(screen.queryByTestId("html-permission-code-banner")).not.toBeInTheDocument()
		expect(screen.queryByTestId("html-permission-reconfirm-badge")).not.toBeInTheDocument()
	})

	it("explains that a high-risk grant will ask again after the code changed", async () => {
		const snapshot = createSnapshot()
		snapshot.permissions[0] = {
			...snapshot.permissions[0],
			codeStatus: "changed",
			needsReconfirm: true,
		}
		snapshot.codeChangedGrantCount = 1
		snapshot.needsReconfirmCount = 1

		renderDialog(snapshot)

		const banner = await screen.findByTestId("html-permission-code-banner")
		expect(banner).toHaveTextContent("htmlEditor.permissionManager.codeBanner.title")
		expect(banner).toHaveTextContent(
			"htmlEditor.permissionManager.codeBanner.descriptionWithReconfirm",
		)
		expect(screen.getByTestId("html-permission-reconfirm-badge")).toBeInTheDocument()
	})

	it("tells the user a read-only grant is still valid after the code changed", async () => {
		const snapshot = createSnapshot()
		snapshot.permissions[0] = {
			...snapshot.permissions[0],
			highRisk: false,
			codeStatus: "changed",
			needsReconfirm: false,
		}
		snapshot.codeChangedGrantCount = 1

		renderDialog(snapshot)

		const banner = await screen.findByTestId("html-permission-code-banner")
		expect(banner).toHaveTextContent(
			"htmlEditor.permissionManager.codeBanner.descriptionReadOnly",
		)
		expect(screen.getByTestId("html-permission-code-changed-badge")).toBeInTheDocument()
		expect(screen.queryByTestId("html-permission-reconfirm-badge")).not.toBeInTheDocument()
	})

	it("acknowledges the current code from the banner and then hides it", async () => {
		const changed = createSnapshot()
		changed.codeChangedGrantCount = 1
		const acknowledged = createSnapshot()
		const onAcknowledgeCodeChanges = vi.fn().mockResolvedValue(acknowledged)

		renderDialog(changed, { onAcknowledgeCodeChanges })
		fireEvent.click(
			await screen.findByRole("button", {
				name: "htmlEditor.permissionManager.codeBanner.acknowledge",
			}),
		)

		await waitFor(() => expect(onAcknowledgeCodeChanges).toHaveBeenCalledOnce())
		await waitFor(() =>
			expect(screen.queryByTestId("html-permission-code-banner")).not.toBeInTheDocument(),
		)
	})
})
