import { BaseProvider } from "../../core/base-provider"

/**
 * Magic Default Provider
 */
export class MagicProvider extends BaseProvider {
	async init(): Promise<void> {}

	start(): void {}

	stop(): void {}

	setConfig(): void {}

	error(): void {}

	report(): void {}
}
