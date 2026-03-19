// Re-export core types and classes
export type {
	FunctionDefinition,
	FunctionMeta,
	FunctionHubOptions,
	FunctionExecutor,
} from "./core/types"

export {
	FunctionNotFoundError,
	FunctionAlreadyExistsError,
	FunctionExecutionError,
} from "./core/errors"

export { FunctionHub } from "./core/FunctionHub"
export { ScopedFunctionHub } from "./core/ScopedFunctionHub"

// Create and export the default instance
import { FunctionHub } from "./core/FunctionHub"
import { registerDefault } from "./registerDefault"

export const functionHub = new FunctionHub()

registerDefault(functionHub)
