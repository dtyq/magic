import { lazy } from "react"

/** Code-split AddModelDialog; mount inside Suspense (fallback null). */
export const AddModelDialogLazy = lazy(() => import("./AddModelDialog"))
