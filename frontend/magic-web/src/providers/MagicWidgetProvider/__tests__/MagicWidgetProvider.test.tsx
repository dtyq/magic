import { act, cleanup, render, screen } from "@testing-library/react"
import { useEffect } from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { MemoryRouter, useNavigate } from "react-router-dom"
import { MagicWidgetProvider, useMagicWidgetConfig } from ".."

const HOST_ORIGIN = "https://widget-host.example.invalid"
const INSTANCE_ID = "widget-mock-provider"

interface WidgetSearchIdentity {
	instanceId?: string
	hostOrigin?: string
}

/** Builds protected Widget query metadata with fully fictional test values. */
function createWidgetSearch(config: unknown, identity: WidgetSearchIdentity = {}): string {
	const params = new URLSearchParams({
		magicWidgetEmbed: "1",
		magicWidgetInstanceId: identity.instanceId ?? INSTANCE_ID,
		magicWidgetProtocolVersion: "1",
		magicWidgetHostOrigin: identity.hostOrigin ?? HOST_ORIGIN,
		magicWidgetConfig: JSON.stringify(config),
	})
	return `?${params.toString()}`
}

/** Renders the current provider value as stable text for protocol assertions. */
function ConfigProbe() {
	const { embedContext, config } = useMagicWidgetConfig()
	return (
		<div>
			<span data-testid="widget-context">{embedContext?.instanceId ?? "none"}</span>
			<span data-testid="widget-config">{JSON.stringify(config)}</span>
		</div>
	)
}

/** Records mount lifecycle so ordinary query navigation cannot hide subtree remounts. */
function MountProbe({ onMount }: { onMount: () => void }) {
	useEffect(() => {
		onMount()
	}, [onMount])
	return <div data-testid="mount-probe" />
}

/** Navigates within the same Widget instance so tests can verify scope preservation. */
function SearchNavigator({ search }: { search: string }) {
	const navigate = useNavigate()
	useEffect(() => {
		navigate(`/global/super/crew/crew-mock-provider${search}`)
	}, [navigate, search])
	return null
}

/** Mounts the document-scoped provider around a small observable consumer. */
function renderProvider(search: string) {
	return render(
		<MemoryRouter initialEntries={[`/global/super/crew/crew-mock-provider${search}`]}>
			<MagicWidgetProvider>
				<ConfigProbe />
			</MagicWidgetProvider>
		</MemoryRouter>,
	)
}

/** Renders a provider whose route query can change without replacing the router. */
function renderNavigableProvider(search: string) {
	return render(
		<MemoryRouter initialEntries={[`/global/super/crew/crew-mock-provider${search}`]}>
			<SearchNavigator search={search} />
			<MagicWidgetProvider>
				<ConfigProbe />
			</MagicWidgetProvider>
		</MemoryRouter>,
	)
}

describe("MagicWidgetProvider", () => {
	let parentWindow: Window
	let postMessage: ReturnType<typeof vi.fn>

	beforeEach(() => {
		postMessage = vi.fn()
		parentWindow = { postMessage } as unknown as Window
	})

	afterEach(() => {
		cleanup()
		Object.defineProperty(window, "parent", {
			configurable: true,
			value: window,
		})
	})

	it("ignores protected query names outside an iframe", () => {
		renderProvider(createWidgetSearch({ layout: "desktop", shell: { appSidebar: false } }))

		expect(screen.getByTestId("widget-context")).toHaveTextContent("none")
		expect(screen.getByTestId("widget-config")).toHaveTextContent("{}")
	})

	it("does not remount ordinary page content when protected Widget query changes", () => {
		const onMount = vi.fn()
		const initialSearch = createWidgetSearch({ layout: "desktop" })
		const view = render(
			<MemoryRouter
				initialEntries={[`/global/super/crew/crew-mock-provider${initialSearch}`]}
			>
				<SearchNavigator search={initialSearch} />
				<MagicWidgetProvider>
					<MountProbe onMount={onMount} />
				</MagicWidgetProvider>
			</MemoryRouter>,
		)

		view.rerender(
			<MemoryRouter
				initialEntries={[`/global/super/crew/crew-mock-provider${initialSearch}`]}
			>
				<SearchNavigator
					search={createWidgetSearch({ layout: "mobile", shell: { appSidebar: false } })}
				/>
				<MagicWidgetProvider>
					<MountProbe onMount={onMount} />
				</MagicWidgetProvider>
			</MemoryRouter>,
		)

		expect(screen.getByTestId("mount-probe")).toBeInTheDocument()
		expect(onMount).toHaveBeenCalledTimes(1)
	})

	it("keeps the initial embed identity when protected query changes in the same document", () => {
		Object.defineProperty(window, "parent", {
			configurable: true,
			value: parentWindow,
		})
		const initialSearch = createWidgetSearch({ layout: "desktop" })
		const view = renderNavigableProvider(initialSearch)

		act(() => {
			window.dispatchEvent(
				new MessageEvent("message", {
					origin: HOST_ORIGIN,
					source: parentWindow,
					data: {
						protocol: "magic-widget",
						version: 1,
						instanceId: INSTANCE_ID,
						requestId: "request-mock-provider-document-scope",
						type: "config",
						config: { layout: "mobile" },
					},
				}),
			)
		})

		view.rerender(
			<MemoryRouter
				initialEntries={[`/global/super/crew/crew-mock-provider${initialSearch}`]}
			>
				<SearchNavigator
					search={createWidgetSearch(
						{ layout: "desktop" },
						{
							instanceId: "widget-mock-replaced-identity",
							hostOrigin: "https://widget-replaced-host.example.invalid",
						},
					)}
				/>
				<MagicWidgetProvider>
					<ConfigProbe />
				</MagicWidgetProvider>
			</MemoryRouter>,
		)

		expect(screen.getByTestId("widget-context")).toHaveTextContent(INSTANCE_ID)
		expect(screen.getByTestId("widget-config")).toHaveTextContent('{"layout":"mobile"}')
	})

	it("applies initial and runtime config only from the bound parent window", () => {
		Object.defineProperty(window, "parent", {
			configurable: true,
			value: parentWindow,
		})
		renderProvider(
			createWidgetSearch({
				layout: "desktop",
				shell: { appSidebar: false },
				conversation: { projectFiles: false, autoHire: false, previewMode: "switchable" },
				responsive: { mobileDetection: "viewport" },
				header: {
					title: "Mock Assistant",
					topicName: { mode: "static", text: "Mock Topic" },
				},
				panel: { connectors: false, digitalEmployees: false },
				bottom: {
					upload: { enabled: false, buttonVisible: false },
					internetSearch: { enabled: true, buttonVisible: false },
				},
				window: { closable: false },
			}),
		)

		expect(screen.getByTestId("widget-context")).toHaveTextContent(INSTANCE_ID)
		expect(screen.getByTestId("widget-config")).toHaveTextContent('"projectFiles":false')
		expect(screen.getByTestId("widget-config")).toHaveTextContent('"autoHire":false')
		expect(screen.getByTestId("widget-config")).toHaveTextContent('"previewMode":"switchable"')
		expect(screen.getByTestId("widget-config")).toHaveTextContent(
			'"mobileDetection":"viewport"',
		)
		expect(screen.getByTestId("widget-config")).toHaveTextContent('"title":"Mock Assistant"')
		expect(screen.getByTestId("widget-config")).toHaveTextContent('"connectors":false')
		expect(screen.getByTestId("widget-config")).toHaveTextContent('"closable":false')
		expect(postMessage).toHaveBeenCalledWith(
			expect.objectContaining({
				type: "config_ready",
				instanceId: INSTANCE_ID,
			}),
			HOST_ORIGIN,
		)

		act(() => {
			window.dispatchEvent(
				new MessageEvent("message", {
					origin: HOST_ORIGIN,
					source: parentWindow,
					data: {
						protocol: "magic-widget",
						version: 1,
						instanceId: INSTANCE_ID,
						requestId: "request-mock-provider-update",
						type: "config",
						config: {
							layout: "mobile",
							conversation: {
								topicHistory: false,
								autoHire: true,
								previewMode: "fullscreen",
							},
							responsive: { mobileDetection: "device-and-viewport" },
						},
					},
				}),
			)
		})

		expect(screen.getByTestId("widget-config")).toHaveTextContent('"layout":"mobile"')
		expect(screen.getByTestId("widget-config")).toHaveTextContent('"topicHistory":false')
		expect(screen.getByTestId("widget-config")).toHaveTextContent('"autoHire":true')
		expect(screen.getByTestId("widget-config")).toHaveTextContent('"previewMode":"fullscreen"')
		expect(screen.getByTestId("widget-config")).toHaveTextContent(
			'"mobileDetection":"device-and-viewport"',
		)
		expect(postMessage).toHaveBeenCalledWith(
			expect.objectContaining({
				requestId: "request-mock-provider-update",
				ok: true,
			}),
			HOST_ORIGIN,
		)
	})

	it("rejects an invalid custom group snapshot without replacing the previous one", () => {
		Object.defineProperty(window, "parent", {
			configurable: true,
			value: parentWindow,
		})
		renderProvider(
			createWidgetSearch({
				layout: "desktop",
				panel: {
					customGroups: [
						{
							id: "provider-valid-group",
							label: "Provider valid group",
							items: [{ id: "provider-valid", type: "card", text: "Provider valid" }],
						},
					],
				},
			}),
		)

		act(() => {
			window.dispatchEvent(
				new MessageEvent("message", {
					origin: HOST_ORIGIN,
					source: parentWindow,
					data: {
						protocol: "magic-widget",
						version: 1,
						instanceId: INSTANCE_ID,
						requestId: "request-provider-invalid-dynamic",
						type: "config",
						config: {
							layout: "desktop",
							panel: {
								customGroups: [
									{
										id: "duplicate-group",
										label: "Duplicate group",
										items: [
											{ id: "duplicate", type: "card", text: "one" },
											{ id: "duplicate", type: "card", text: "two" },
										],
									},
								],
							},
						},
					},
				}),
			)
		})

		expect(screen.getByTestId("widget-config")).toHaveTextContent("provider-valid")
		expect(postMessage).toHaveBeenLastCalledWith(
			expect.objectContaining({
				requestId: "request-provider-invalid-dynamic",
				ok: false,
				error: expect.objectContaining({ code: "INVALID_CONFIG" }),
			}),
			HOST_ORIGIN,
		)
	})

	it("filters custom group overflow and acknowledges the non-fatal warning", () => {
		Object.defineProperty(window, "parent", {
			configurable: true,
			value: parentWindow,
		})
		renderProvider(createWidgetSearch({ layout: "desktop" }))

		act(() => {
			window.dispatchEvent(
				new MessageEvent("message", {
					origin: HOST_ORIGIN,
					source: parentWindow,
					data: {
						protocol: "magic-widget",
						version: 1,
						instanceId: INSTANCE_ID,
						requestId: "request-provider-filtered-config",
						type: "config",
						config: {
							layout: "desktop",
							panel: {
								customGroups: Array.from({ length: 51 }, (_, index) => ({
									id: `provider-fixture-group-${index}`,
									label: `Provider fixture group ${index}`,
									items: [],
								})),
							},
						},
					},
				}),
			)
		})

		expect(screen.getByTestId("widget-config")).toHaveTextContent("provider-fixture-group-49")
		expect(screen.getByTestId("widget-config")).not.toHaveTextContent(
			"provider-fixture-group-50",
		)
		expect(postMessage).toHaveBeenLastCalledWith(
			expect.objectContaining({
				requestId: "request-provider-filtered-config",
				ok: true,
				result: {
					configWarning: expect.objectContaining({
						code: "CUSTOM_MENTION_FILTERED",
						details: expect.objectContaining({
							droppedGroups: 1,
							reasons: ["MAX_GROUPS"],
						}),
					}),
				},
			}),
			HOST_ORIGIN,
		)
	})

	it("applies a host config snapshot without rechecking field values", () => {
		Object.defineProperty(window, "parent", {
			configurable: true,
			value: parentWindow,
		})
		renderProvider(createWidgetSearch({ layout: "desktop" }))

		act(() => {
			window.dispatchEvent(
				new MessageEvent("message", {
					origin: HOST_ORIGIN,
					source: parentWindow,
					data: {
						protocol: "magic-widget",
						version: 1,
						instanceId: INSTANCE_ID,
						requestId: "request-mock-provider-unvalidated",
						type: "config",
						config: {
							layout: "desktop",
							conversation: { projectFiles: "invalid" },
							responsive: { mobileDetection: "device-only" },
						},
					},
				}),
			)
		})

		expect(screen.getByTestId("widget-config")).toHaveTextContent('"projectFiles":"invalid"')
		expect(screen.getByTestId("widget-config")).toHaveTextContent(
			'"mobileDetection":"device-only"',
		)
		expect(postMessage).toHaveBeenCalledWith(
			expect.objectContaining({
				requestId: "request-mock-provider-unvalidated",
				ok: true,
			}),
			HOST_ORIGIN,
		)
	})

	it("drops a non-object config without replacing the last snapshot", () => {
		Object.defineProperty(window, "parent", {
			configurable: true,
			value: parentWindow,
		})
		renderProvider(createWidgetSearch({ layout: "desktop" }))

		act(() => {
			window.dispatchEvent(
				new MessageEvent("message", {
					origin: HOST_ORIGIN,
					source: parentWindow,
					data: {
						protocol: "magic-widget",
						version: 1,
						instanceId: INSTANCE_ID,
						requestId: "request-mock-provider-non-object",
						type: "config",
						config: null,
					},
				}),
			)
		})

		expect(screen.getByTestId("widget-config")).toHaveTextContent('{"layout":"desktop"}')
		expect(postMessage).toHaveBeenCalledWith(
			expect.objectContaining({
				requestId: "request-mock-provider-non-object",
				ok: false,
				error: expect.objectContaining({ code: "INVALID_CONFIG" }),
			}),
			HOST_ORIGIN,
		)
	})

	it("preserves runtime config when only unrelated query parameters change", () => {
		Object.defineProperty(window, "parent", {
			configurable: true,
			value: parentWindow,
		})
		const initialSearch = createWidgetSearch({ layout: "desktop" })
		const view = renderNavigableProvider(initialSearch)

		act(() => {
			window.dispatchEvent(
				new MessageEvent("message", {
					origin: HOST_ORIGIN,
					source: parentWindow,
					data: {
						protocol: "magic-widget",
						version: 1,
						instanceId: INSTANCE_ID,
						requestId: "request-mock-provider-preserve",
						type: "config",
						config: { layout: "mobile" },
					},
				}),
			)
		})

		view.rerender(
			<MemoryRouter
				initialEntries={[`/global/super/crew/crew-mock-provider${initialSearch}`]}
			>
				<SearchNavigator search={`${initialSearch}&tab=mock`} />
				<MagicWidgetProvider>
					<ConfigProbe />
				</MagicWidgetProvider>
			</MemoryRouter>,
		)

		expect(screen.getByTestId("widget-config")).toHaveTextContent('{"layout":"mobile"}')
	})

	it("forwards only the bound host dismiss command to iframe preview consumers", () => {
		Object.defineProperty(window, "parent", {
			configurable: true,
			value: parentWindow,
		})
		const listener = vi.fn()
		window.addEventListener("magic-widget:dismiss-preview", listener)
		renderProvider(createWidgetSearch({ layout: "desktop" }))

		act(() => {
			window.dispatchEvent(
				new MessageEvent("message", {
					origin: HOST_ORIGIN,
					source: parentWindow,
					data: {
						protocol: "magic-widget",
						version: 1,
						instanceId: INSTANCE_ID,
						type: "ui_command",
						command: "dismiss_preview",
					},
				}),
			)
			window.dispatchEvent(
				new MessageEvent("message", {
					origin: "https://untrusted-widget.example.invalid",
					source: parentWindow,
					data: {
						protocol: "magic-widget",
						version: 1,
						instanceId: INSTANCE_ID,
						type: "ui_command",
						command: "dismiss_preview",
					},
				}),
			)
		})

		expect(listener).toHaveBeenCalledTimes(1)
		window.removeEventListener("magic-widget:dismiss-preview", listener)
	})
})
