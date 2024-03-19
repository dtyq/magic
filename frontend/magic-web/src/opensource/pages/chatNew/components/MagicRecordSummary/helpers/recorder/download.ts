/**
 * 下载录音文件
 * @private
 * @param {*} blob      blob数据
 * @param {string} name 下载的文件名
 * @param {string} type 下载的文件后缀
 */
function _download(blob: Blob | MediaSource, name: string, type: string): void {
	const oA = document.createElement("a")

	oA.href = window.URL.createObjectURL(blob)
	oA.download = `${name}.${type}`
	oA.click()
}

/**
 * 下载录音的wav数据
 *
 * @param {blob}   需要下载的blob数据类型
 * @param {string} [name='recorder']    重命名的名字
 */
export function downloadWAV(wavblob: any, name: string = "recorder"): void {
	_download(wavblob, name, "wav")
}

/**
 * 下载录音pcm数据
 *
 * @param {blob}   需要下载的blob数据类型
 * @param {string} [name='recorder']    重命名的名字
 * @memberof Recorder
 */
export function downloadPCM(pcmBlob: any, name: string = "recorder"): void {
	_download(pcmBlob, name, "pcm")
}

// 通用下载接口
export function download(blob: any, name: string, type: string) {
	return _download(blob, name, type)
}
