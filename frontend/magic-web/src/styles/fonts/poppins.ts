import { useEffect } from "react"

const defaultPoppinsWeights = [300, 400, 600, 900] as const

type PoppinsFontWeight = (typeof defaultPoppinsWeights)[number]

const poppinsWeightLoaders: Record<PoppinsFontWeight, () => Promise<unknown>> = {
	300: () => import("@fontsource/poppins/300.css"),
	400: () => import("@fontsource/poppins/400.css"),
	600: () => import("@fontsource/poppins/600.css"),
	900: () => import("@fontsource/poppins/900.css"),
}

const loadedWeights = new Set<PoppinsFontWeight>()
const loadingWeightPromises = new Map<PoppinsFontWeight, Promise<unknown>>()

function loadPoppinsWeight(weight: PoppinsFontWeight) {
	if (loadedWeights.has(weight)) return Promise.resolve()

	const existingPromise = loadingWeightPromises.get(weight)
	if (existingPromise) return existingPromise

	const promise = poppinsWeightLoaders[weight]()
		.then(() => {
			loadedWeights.add(weight)
		})
		.finally(() => {
			loadingWeightPromises.delete(weight)
		})

	loadingWeightPromises.set(weight, promise)

	return promise
}

function usePoppinsFont(weights: PoppinsFontWeight[] = [...defaultPoppinsWeights]) {
	const weightKey = Array.from(new Set(weights))
		.sort((a, b) => a - b)
		.join(",")

	useEffect(() => {
		const requestedWeights = (weightKey
			.split(",")
			.filter(Boolean)
			.map((weight) => Number(weight)) || []) as PoppinsFontWeight[]

		requestedWeights.forEach((weight) => {
			void loadPoppinsWeight(weight)
		})
	}, [weightKey])
}

export default usePoppinsFont
