import type { NativeSafeArea } from "./types"

export interface UiPort {
	getSafeArea(): Promise<NativeSafeArea>
}
