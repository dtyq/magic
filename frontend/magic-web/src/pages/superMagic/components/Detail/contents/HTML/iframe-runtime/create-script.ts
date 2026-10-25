// eslint-disable-next-line import/no-unresolved -- Compiled by the app/test Vite plugin.
import scripts from "virtual:magic-iframe-runtime"
import { serializeScriptData } from "../utils/serialize-script-data"
import type telemetry from "./telemetry"
import type contentMetrics from "./content-metrics"
import type serviceWorker from "./service-worker"
import type legacyCookie from "./legacy-cookie"
import type legacyStorage from "./legacy-storage"
import type legacyIndexedDB from "./legacy-indexed-db"
import type navigation from "./navigation"
import type touchPinch from "./touch-pinch"

interface Installers {
	"touch-pinch": typeof touchPinch
	telemetry: typeof telemetry
	"content-metrics": typeof contentMetrics
	"service-worker": typeof serviceWorker
	"legacy-cookie": typeof legacyCookie
	"legacy-storage": typeof legacyStorage
	"legacy-indexed-db": typeof legacyIndexedDB
	navigation: typeof navigation
}

/** Parameters are data, never source fragments. HTML parses </script> before JS. */
export function createIframeRuntimeScript<K extends keyof Installers>(
	name: K,
	options: Parameters<Installers[K]>[0],
): string {
	const script = scripts[name]
	if (!script) throw new Error(`Missing compiled iframe installer: ${name}`)
	const data = serializeScriptData(options)
	return `${script}(${data});`
}
