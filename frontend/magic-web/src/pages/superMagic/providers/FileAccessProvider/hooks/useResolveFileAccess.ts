import { DEFAULT_FILE_ACCESS } from "../constants"
/** Internal root policy input; customer overlays may resolve environment constraints. */
export function useResolveFileAccess() {
	return DEFAULT_FILE_ACCESS
}
