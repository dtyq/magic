import { describe, expect, it } from "vitest"
import { buildWidgetIframeUrl } from "../src/url"
import { WIDGET_QUERY_CONFIG } from "../src/protocol"

describe("buildWidgetIframeUrl", () => {
	it("builds a typed crew page with script origin, login strategy, organization and extra query", () => {
		const url = buildWidgetIframeUrl(
			{
				page: {
					type: "crew",
					crewId: "crew-001",
				},
				auth: {
					loginStrategy: "phone_password",
					organizationCode: "org-001",
				},
				iframe: {
					query: {
						source: "external-widget",
					},
				},
			},
			{
				fallbackAppOrigin: "https://www.letsmagic.cn",
			},
		)

		expect(url.origin).toBe("https://www.letsmagic.cn")
		expect(url.pathname).toBe("/global/super/crew/crew-001")
		expect(url.searchParams.get("login-strategy")).toBe("phone_password")
		expect(url.searchParams.get("organizationCode")).toBe("org-001")
		expect(url.searchParams.get("source")).toBe("external-widget")
	})

	it("uses the script origin fallback", () => {
		const url = buildWidgetIframeUrl(
			{
				page: {
					type: "crew",
					crewId: "crew-001",
				},
			},
			{
				fallbackAppOrigin: "https://magic.example.com",
			},
		)

		expect(url.toString()).toBe("https://magic.example.com/global/super/crew/crew-001")
	})

	it("writes protected initial config after host query values", () => {
		const url = buildWidgetIframeUrl(
			{
				page: { type: "crew", crewId: "crew-mock-config" },
				config: {
					layout: "desktop",
					shell: { appSidebar: false },
					conversation: { projectFiles: false, topicHistory: true },
				},
				iframe: { query: { [WIDGET_QUERY_CONFIG]: "forged-config" } },
			},
			{
				fallbackAppOrigin: "https://widget-app.example.invalid",
				instanceId: "widget-mock-config",
				hostOrigin: "https://widget-host.example.invalid",
			},
		)

		expect(JSON.parse(url.searchParams.get(WIDGET_QUERY_CONFIG) ?? "null")).toEqual({
			layout: "desktop",
			shell: { appSidebar: false },
			conversation: { projectFiles: false, topicHistory: true },
		})
		expect(url.searchParams.getAll(WIDGET_QUERY_CONFIG)).toHaveLength(1)
	})

	it("keeps custom Mention groups out of the initial URL payload", () => {
		const url = buildWidgetIframeUrl(
			{
				page: { type: "crew", crewId: "crew-dynamic-url" },
				config: {
					layout: "desktop",
					panel: {
						customGroups: [
							{
								id: "group-url",
								label: "URL group",
								items: [{ id: "item-url", type: "card", text: "URL fixture" }],
							},
						],
					},
				},
			},
			{
				fallbackAppOrigin: "https://widget-app.example.invalid",
				instanceId: "widget-dynamic-url",
				hostOrigin: "https://widget-host.example.invalid",
				renderMode: "inline",
			},
		)

		expect(JSON.parse(url.searchParams.get(WIDGET_QUERY_CONFIG) ?? "null")).toEqual({
			layout: "desktop",
		})
		expect(url.searchParams.get("magicWidgetRenderMode")).toBe("inline")
	})

	it("uses the private deployment code as the crew route segment", () => {
		const url = buildWidgetIframeUrl(
			{
				page: {
					type: "crew",
					crewId: "crew-mock-private",
				},
				auth: {
					deploymentCode: " private-mock ",
					organizationCode: "org-mock-private",
				},
			},
			{
				fallbackAppOrigin: "https://magic.example.invalid",
			},
		)

		expect(url.pathname).toBe("/private-mock/super/crew/crew-mock-private")
		expect(url.searchParams.get("organizationCode")).toBe("org-mock-private")
	})

	it("uses the private route and forwards the deployment code for private login", () => {
		const url = buildWidgetIframeUrl(
			{
				page: {
					type: "crew",
					crewId: "crew-mock-private-form",
				},
				auth: {
					loginStrategy: "private_deployment",
					deploymentCode: " private-code-mock ",
				},
			},
			{
				fallbackAppOrigin: "https://magic.example.invalid",
			},
		)

		expect(url.pathname).toBe("/private-code-mock/super/crew/crew-mock-private-form")
		expect(url.searchParams.get("login-strategy")).toBe("private_deployment")
		expect(url.searchParams.get("magicWidgetDeploymentCode")).toBe("private-code-mock")
	})

	it("keeps the SaaS route when the deployment code is empty", () => {
		const url = buildWidgetIframeUrl(
			{
				page: {
					type: "crew",
					crewId: "crew-mock-saas",
				},
				auth: {
					deploymentCode: "   ",
				},
			},
			{
				fallbackAppOrigin: "https://magic.example.invalid",
			},
		)

		expect(url.pathname).toBe("/global/super/crew/crew-mock-saas")
	})

	it("encodes the crew id as one path segment", () => {
		const url = buildWidgetIframeUrl(
			{
				page: {
					type: "crew",
					crewId: "crew/a b",
				},
			},
			{
				fallbackAppOrigin: "https://www.letsmagic.cn",
			},
		)

		expect(url.toString()).toBe("https://www.letsmagic.cn/global/super/crew/crew%2Fa%20b")
	})

	it("rejects empty crew ids", () => {
		expect(() =>
			buildWidgetIframeUrl(
				{
					page: {
						type: "crew",
						crewId: " ",
					},
				},
				{
					fallbackAppOrigin: "https://www.letsmagic.cn",
				},
			),
		).toThrow(/crewId/)
	})

	it("rejects missing page options with a stable error", () => {
		expect(() =>
			buildWidgetIframeUrl({} as never, {
				fallbackAppOrigin: "https://www.letsmagic.cn",
			}),
		).toThrow("Magic widget page is required")
	})

	it("rejects missing crew ids with a stable error", () => {
		expect(() =>
			buildWidgetIframeUrl(
				{
					page: {
						type: "crew",
					},
				} as never,
				{
					fallbackAppOrigin: "https://www.letsmagic.cn",
				},
			),
		).toThrow("Magic widget crewId must be a string")
	})

	it("rejects legacy top-level organization codes with a stable error", () => {
		expect(() =>
			buildWidgetIframeUrl(
				{
					page: {
						type: "crew",
						crewId: "crew-001",
					},
					organizationCode: "org-001",
				} as never,
				{
					fallbackAppOrigin: "https://www.letsmagic.cn",
				},
			),
		).toThrow("Magic widget organizationCode must be configured through auth.organizationCode")
	})

	it("rejects non-string auth organization codes with a stable error", () => {
		expect(() =>
			buildWidgetIframeUrl(
				{
					page: {
						type: "crew",
						crewId: "crew-001",
					},
					auth: {
						organizationCode: 123,
					},
				} as never,
				{
					fallbackAppOrigin: "https://www.letsmagic.cn",
				},
			),
		).toThrow("Magic widget auth.organizationCode must be a string")
	})

	it("rejects non-string deployment codes with a stable error", () => {
		expect(() =>
			buildWidgetIframeUrl(
				{
					page: {
						type: "crew",
						crewId: "crew-mock-invalid-deployment",
					},
					auth: {
						deploymentCode: 123,
					},
				} as never,
				{
					fallbackAppOrigin: "https://magic.example.invalid",
				},
			),
		).toThrow("Magic widget auth.deploymentCode must be a string")
	})

	it("rejects the removed private deployment code field with a migration error", () => {
		expect(() =>
			buildWidgetIframeUrl(
				{
					page: {
						type: "crew",
						crewId: "crew-mock-legacy-private-code",
					},
					auth: {
						privateDeploymentCode: "private-code-mock",
					},
				} as never,
				{
					fallbackAppOrigin: "https://magic.example.invalid",
				},
			),
		).toThrow("Magic widget auth.privateDeploymentCode has been removed")
	})
})
