import { useMemoizedFn } from "ahooks"
import { useState } from "react"

/**
 * 图片旋转
 */
const useRotate = (step = 90) => {
	const [rotate, setRotate] = useState(0)

	const rotateImage = useMemoizedFn(() => {
		setRotate((r) => r + step)
	})

	return {
		rotate,
		rotateImage,
	}
}

export default useRotate
