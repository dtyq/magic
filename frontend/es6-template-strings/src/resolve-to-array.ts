import resolve from "./resolve"
import passthru from "./passthru-array"
import type { Result } from "./compile"
import type { ResolveOptions } from "./types"

export default (data: Result, context: Record<string, any>, options?: ResolveOptions) => {
	const [literals, ...result] = resolve(data, context, options)
	return passthru.call(null, literals as Array<string>, ...(result as Array<string>))
}
