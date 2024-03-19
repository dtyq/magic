export const getExpandedSize = (size: string | number): number => {
	return typeof size === "string" && size.includes("vh")
		? (window.innerHeight * parseFloat(size.replace("vh", ""))) / 100
		: typeof size === "string" && size.includes("vw")
			? (window.innerWidth * parseFloat(size.replace("vw", ""))) / 100
			: typeof size === "number"
				? size
				: 0
}
