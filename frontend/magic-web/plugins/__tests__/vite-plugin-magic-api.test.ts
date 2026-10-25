import { TextDecoder, TextEncoder } from "node:util"
import { runInNewContext } from "node:vm"
import vitePluginMagicApi from "../vite-plugin-magic-api"

const originalTextDecoder = globalThis.TextDecoder
const originalTextEncoder = globalThis.TextEncoder
const originalUint8Array = globalThis.Uint8Array

describe("vitePluginMagicApi", () => {
	afterEach(() => {
		Object.assign(globalThis, {
			TextDecoder: originalTextDecoder,
			TextEncoder: originalTextEncoder,
			Uint8Array: originalUint8Array,
		})
	})

	it("builds the prelude without requiring html-sandbox dist files", async () => {
		const encodedTextConstructor = new TextEncoder().encode("").constructor
		Object.assign(globalThis, {
			TextDecoder,
			TextEncoder,
			Uint8Array: encodedTextConstructor,
		})

		const plugin = vitePluginMagicApi({ projectRoot: process.cwd() })

		if (!("resolveId" in plugin) || typeof plugin.resolveId !== "function") {
			throw new Error("resolveId hook is required")
		}
		if (!("load" in plugin) || typeof plugin.load !== "function") {
			throw new Error("load hook is required")
		}

		const resolvedId = await plugin.resolveId.call(
			{} as never,
			"virtual:magic-api",
			undefined,
			{} as never,
		)

		expect(resolvedId).toBe("\0virtual:magic-api")

		const loaded = await plugin.load.call({} as never, resolvedId as string, {} as never)
		expect(String(loaded)).toContain("export default")
		expect(String(loaded)).toContain("MAGIC_API_PRELUDE_ERROR")
		expect(String(loaded)).not.toContain("@dtyq/html-sandbox")

		// Execute the compiled prelude as it runs in an iframe: runtime classes
		// come from the shell, while the origin helper is bundled from source.
		const postMessage = vi.fn()
		const fakeWindow = {
			parent: { postMessage },
			location: { origin: "https://sandbox.example" },
			Magic: {} as { reload?: () => void },
			MagicHtmlSandboxRuntime: {
				BaseRuntimeBridgeApiPlugin: class {
					logger = { info: vi.fn() }
					constructor(public source: string) {}
				},
				registerRuntimePlugins: vi.fn(),
			},
		}
		const script = JSON.parse(String(loaded).slice("export default ".length))
		runInNewContext(script, {
			window: fakeWindow,
			location: { ancestorOrigins: ["https://host.example"] },
			document: { referrer: "" },
			URL,
		})
		const register = fakeWindow.MagicHtmlSandboxRuntime.registerRuntimePlugins
		expect(register).toHaveBeenCalledOnce()
		const plugins = register.mock.calls[0][0] as Array<
			new () => { source: string; install(): void }
		>
		const reload = plugins
			.map((Plugin) => new Plugin())
			.find((plugin) => plugin.source === "MagicReloadApi")
		expect(reload).toBeDefined()
		reload?.install()
		fakeWindow.Magic.reload?.()
		expect(postMessage).toHaveBeenCalledWith(
			expect.objectContaining({ type: "MAGIC_RELOAD_REQUEST" }),
			"https://host.example",
		)
	})
})
