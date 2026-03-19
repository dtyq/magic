import { useMemoizedFn } from "ahooks"

const useCurrentImageSwitcher = () => {
	// const [prevImage, setPrevImage] = useState<PreviewFileInfo>()
	// const [nextImage, setNextImage] = useState<PreviewFileInfo>()

	// const getPrevImage = useMemoizedFn(async (): Promise<PreviewFileInfo | undefined> => {
	// 	const currentMessageId = previewFileInfo?.messageId
	// 	if (!currentMessageId || !messagesIds || !messagesIds.length) return undefined

	// 	const index = previewFileInfo.index ?? 0

	// 	let image

	// 	if (index > 0) {
	// 		const images = await getConversationMessageImages(currentMessageId, getMessage(currentMessageId)?.message)

	// 		image = {
	// 			...images[index - 1],
	// 			conversationId: previewFileInfo.conversationId,
	// 			index: index - 1,
	// 		}
	// 	} else if (index === 0) {
	// 		let prevMessageIdIndex = messagesIds.findIndex((id) => id === currentMessageId)

	// 		while (prevMessageIdIndex > 0) {
	//       const prevMessage = getMessage(messagesIds[prevMessageIdIndex - 1])
	//       if (!prevMessage) return undefined
	// 			// eslint-disable-next-line no-await-in-loop
	// 			const images = await getConversationMessageImages(prevMessage?.message_id, prevMessage?.message)
	// 			if (images.length > 0) {
	// 				image = {
	// 					...images[images.length - 1],
	// 					conversationId: previewFileInfo.conversationId,
	// 					index: images.length - 1,
	// 				}
	// 				break
	// 			}
	// 			prevMessageIdIndex -= 1
	// 		}
	// 	}
	// 	return image
	// })

	// const getNextImage = useMemoizedFn(async (): Promise<PreviewFileInfo | undefined> => {
	// 	const currentMessageId = previewFileInfo?.messageId
	// 	if (!currentMessageId || !messagesIds || !messagesIds.length) return undefined
	// 	const index = previewFileInfo.index ?? 0

	// 	const images = await getConversationMessageImages(currentMessageId, getMessage(currentMessageId)?.message)

	// 	if (index < images.length - 1) {
	// 		return {
	// 			conversationId: previewFileInfo.conversationId,
	// 			index: index + 1,
	// 			...images[index + 1],
	// 		}
	// 	}
	// 	if (index === images.length - 1) {
	// 		let nextMessageIdIndex = messagesIds.findIndex((id) => id === currentMessageId)
	// 		while (nextMessageIdIndex < messagesIds.length - 1) {
	// 			const nextMessage = getMessage(messagesIds[nextMessageIdIndex + 1])
	// 			if (!nextMessage) return undefined
	// 			// eslint-disable-next-line no-await-in-loop
	// 			const nextMessageImages = await getConversationMessageImages(nextMessage?.message_id, nextMessage?.message)
	// 			if (nextMessageImages.length > 0) {
	// 				return {
	// 					...nextMessageImages[0],
	// 					conversationId: previewFileInfo.conversationId,
	// 					index: 0,
	// 				}
	// 			}
	// 			nextMessageIdIndex += 1
	// 		}
	// 	}
	// 	return undefined
	// })

	// useEffect(() => {
	// 	if (!previewFileInfo) {
	// 		setPrevImage(undefined)
	// 		setNextImage(undefined)
	// 	} else {
	// 		getPrevImage().then((image) => {
	// 			setPrevImage(image)
	// 		})
	// 		getNextImage().then((image) => {
	// 			setNextImage(image)
	// 		})
	// 	}
	// }, [getNextImage, getPrevImage, previewFileInfo])

	const toPrev = useMemoizedFn(() => {
		// if (prevImage) {
		// MessageFilePreviewService.setPreviewInfo(prevImage)
		// }
	})

	const toNext = useMemoizedFn(() => {
		// if (nextImage) {
		// MessageFilePreviewService.setPreviewInfo(nextImage)
		// }
	})

	return { toPrev, toNext, prevDisabled: true, nextDisabled: true }
}

export default useCurrentImageSwitcher
