import type { NativeEnvResult, NativeEnvType } from "./types"

export interface EnvironmentPort {
	changeEnv(env: NativeEnvType): Promise<unknown>
	getEnv(): Promise<NativeEnvResult>
	webHasNewVersionToUpdate(): Promise<unknown>
}
