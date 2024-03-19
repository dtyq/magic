import { omit } from "lodash-es"
import compile from "./compile"
import resolve from "./resolve-to-array"
import type { CompileOptions, TemplateOptions } from "./types"

export default function toArray(
	template: string,
	context: Record<string, any>,
	options?: TemplateOptions,
) {
	const compileOptions: CompileOptions = omit(options, "partial")
	return resolve(compile(template, compileOptions), context, { partial: options?.partial })
}
