import { getOptimizedImageUrl } from "./image-optimization"

export const getAvatarUrl = (avatar: string, height: number = 50) => {
	return getOptimizedImageUrl(avatar, {
		variant: "thumbnail",
		height,
	})
}
