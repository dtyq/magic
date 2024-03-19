import { DEFAULT_FONT_SIZE_BASE } from "@/common/const/style"
import { platformKey } from "@/common/utils/storage"
import { create } from "zustand"
import { createJSONStorage, persist } from "zustand/middleware"
import { ThemeMode } from "../ThemeProvider/hooks"

export const enum IMStyle {
	Modern = "modern",
	Standard = "standard",
}

export interface AppearanceState {
	theme: ThemeMode
	imStyle: IMStyle
	chatFontSize: number
}

export const useAppearanceStore = create<AppearanceState>()(
	persist<AppearanceState>(
		() => ({
			theme: "auto",
			imStyle: IMStyle.Standard,
			chatFontSize: DEFAULT_FONT_SIZE_BASE,
		}),
		{
			name: platformKey("store:appearance"),
			storage: createJSONStorage(() => localStorage),
		},
	),
)
