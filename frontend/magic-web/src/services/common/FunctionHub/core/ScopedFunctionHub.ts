import type { FunctionDefinition, FunctionExecutor, FunctionMeta } from "./types"
import type { FunctionHub } from "./FunctionHub"

/**
 * Scoped FunctionHub for namespace organization
 */
export class ScopedFunctionHub {
	constructor(
		private hub: FunctionHub,
		private prefix: string,
	) {}

	private getFullName(name: string): string {
		return `${this.prefix}.${name}`
	}

	register<TArgs extends readonly unknown[] = readonly unknown[], TReturn = unknown>(
		definition: Omit<FunctionDefinition<TArgs, TReturn>, "name"> & { name: string },
	): this {
		this.hub.register({
			...definition,
			name: this.getFullName(definition.name),
		})
		return this
	}

	inject<TArgs extends readonly unknown[] = readonly unknown[], TReturn = unknown>(
		name: string,
		fn: FunctionExecutor<TArgs, TReturn>,
		description?: string,
	): this {
		this.hub.inject(this.getFullName(name), fn, description)
		return this
	}

	override<TArgs extends readonly unknown[] = readonly unknown[], TReturn = unknown>(
		name: string,
		fn: FunctionExecutor<TArgs, TReturn>,
		description?: string,
	): this {
		this.hub.override(this.getFullName(name), fn, description)
		return this
	}

	execute<TReturn = unknown, TArgs extends readonly unknown[] = readonly unknown[]>(
		name: string,
		...args: TArgs
	): TReturn {
		return this.hub.execute(this.getFullName(name), ...args)
	}

	has(name: string): boolean {
		return this.hub.has(this.getFullName(name))
	}

	remove(name: string): boolean {
		return this.hub.remove(this.getFullName(name))
	}

	getMeta(name: string): FunctionMeta | undefined {
		return this.hub.getMeta(this.getFullName(name))
	}
}
