import { compress, encodePCM, encodeWAV } from "./transform"
import Player from "./player"
import BaseRecorder from "./base"
import { download, downloadWAV } from "./download"

// 构造函数参数格式
interface RecorderConfig {
	sampleBits?: number // 采样位数
	sampleRate?: number // 采样率
	numChannels?: number // 声道数
	compiling?: boolean // 是否边录边播
}

class Recorder extends BaseRecorder {
	private isrecording: boolean = false // 是否正在录音

	private ispause: boolean = false // 是否是暂停

	private isplaying: boolean = false // 是否正在播放

	/**
	 * @param {Object} options 包含以下三个参数：
	 * sampleBits，采样位数，一般8,16，默认16
	 * sampleRate，采样率，一般 11025、16000、22050、24000、44100、48000，默认为浏览器自带的采样率
	 * numChannels，声道，1或2
	 */
	constructor(options: RecorderConfig = {}) {
		super(options)
	}

	/**
	 * 重新修改配置
	 *
	 * @param {RecorderConfig} [options={}]
	 * @memberof Recorder
	 */
	public setOption(options: RecorderConfig = {}) {
		this.setNewOption(options)
	}

	/**
	 * Start the recording
	 */
	async start() {
		if (this.isrecording) {
			// 正在录音，则不允许
			return
		}

		this.isrecording = true

		await this.startRecord()
	}

	/**
	 * Pause the recording
	 */
	pause(): void {
		if (this.isrecording && !this.ispause) {
			this.ispause = true
			// 当前不暂停的时候才可以暂停
			this.pauseRecord()
		}
	}

	/**
	 * 继续录音
	 */
	resume(): void {
		if (this.isrecording && this.ispause) {
			this.ispause = false
			this.resumeRecord()
		}
	}

	/**
	 * 停止录音
	 *
	 * @memberof Recorder
	 */
	stop(): void {
		if (this.isrecording) {
			this.isrecording = false
			this.ispause = false
			this.stopRecord()
		}
	}

	/**
	 * 播放录音
	 */
	play(): void {
		this.stop()
		// 关闭前一次音频播放
		this.isplaying = true

		if (this.onplay) this.onplay()
		Player.addPlayEnd(this.onplayend) // 注册播放完成后的回调事件

		const dataV = this.getWAV()

		if (dataV.byteLength > 44) {
			Player.play(dataV.buffer) // 播放
		}
	}

	/**
	 * 获取已经播放了多长时间
	 */
	getPlayTime(): number {
		return Player.getPlayTime()
	}

	/**
	 * 暂停播放录音
	 *
	 * @memberof Recorder
	 */
	pausePlay(): void {
		if (this.isrecording || !this.isplaying) {
			// 正在录音或没有播放，暂停无效
			return
		}

		this.isplaying = false
		this.onpauseplay && this.onpauseplay()
		Player.pausePlay()
	}

	/**
	 * 恢复播放录音
	 *
	 * @memberof Recorder
	 */
	resumePlay(): void {
		if (this.isrecording || this.isplaying) {
			// 正在录音或已经播放或没开始播放，恢复无效
			return
		}

		this.isplaying = true
		this.onresumeplay && this.onresumeplay()
		Player.resumePlay()
	}

	/**
	 * 停止播放
	 *
	 * @memberof Recorder
	 */
	stopPlay(): void {
		if (this.isrecording) {
			// 正在录音，停止录音播放无效
			return
		}

		this.isplaying = false
		this.onstopplay && this.onstopplay()
		Player.stopPlay()
	}

	destroy(): Promise<object> {
		Player.destroyPlay()

		return this.destroyRecord()
	}

	/**
	 * 获取当前已经录音的PCM音频数据
	 *
	 * @returns[DataView]
	 * @memberof Recorder
	 */
	// getWholeData() {
	//     return this.tempPCM;
	// }

	/**
	 * 获取余下的新数据，不包括 getNextData 前一次获取的数据
	 *
	 * @returns [DataView]
	 * @memberof Recorder
	 */
	// getNextData() {
	//     let length = this.tempPCM.length,
	//         data = this.tempPCM.slice(this.offset);

	//     this.offset = length;

	//     return data;
	// }

	/**
	 * 获取当前录音的波形数据，
	 * 调取频率由外部控制。
	 *
	 * @memberof Recorder
	 */
	getRecordAnalyseData(): any {
		return this.getAnalyseData()
	}

	/**
	 * 获取录音播放时的波形数据，
	 *
	 * @memberof Recorder
	 */
	getPlayAnalyseData(): any {
		// 现在录音和播放不允许同时进行，所有复用的录音的analyser节点。
		return Player.getAnalyseData()
	}

	getPCM(): any {
		// 获取pcm数据
		let data: any = this.getData()
		// 根据输入输出比例 压缩或扩展
		data = compress(data, this.inputSampleRate, this.outputSampleRate)
		// 按采样位数重新编码
		return encodePCM(data, this.oututSampleBits, this.littleEdian)
	}

	/**
	 * 获取PCM格式的blob数据
	 *
	 * @returns { blob }  PCM格式的blob数据
	 * @memberof Recorder
	 */
	getPCMBlob(): any {
		return new Blob([this.getPCM()])
	}

	/**
	 * 获取WAV编码的二进制数据(dataview)
	 *
	 * @returns {dataview}  WAV编码的二进制数据
	 * @memberof Recorder
	 */
	getWAV(): any {
		const pcmTemp = this.getPCM()

		// PCM增加44字节的头就是WAV格式了
		return encodeWAV(
			pcmTemp,
			this.inputSampleRate,
			this.outputSampleRate,
			this.config.numChannels!,
			this.oututSampleBits,
			this.littleEdian,
		)
	}

	/**
	 * 获取WAV音频的blob数据
	 *
	 * @returns { blob }    wav格式blob数据
	 * @memberof Recorder
	 */
	getWAVBlob(): any {
		const result = new Blob([this.getWAV()], { type: "audio/wav" })
		return result
	}

	getWavBlobByData(data: any): any {
		// 根据输入输出比例 压缩或扩展
		data = compress(data, this.inputSampleRate, this.outputSampleRate)
		// 按采样位数重新编码
		const pcmTemp = encodePCM(data, this.oututSampleBits, this.littleEdian)
		// PCM增加44字节的头就是WAV格式了
		const WAV = encodeWAV(
			pcmTemp,
			this.inputSampleRate,
			this.outputSampleRate,
			this.config.numChannels!,
			this.oututSampleBits,
			this.littleEdian,
		)
		const WAVBlob = new Blob([WAV], { type: "audio/wav" })
		return WAVBlob
	}

	/**
	 * 获取单次WAV音频的blob数据
	 */
	getOnceWAVBlob(): any {
		const data = this.getOnceData()
		return this.getWavBlobByData(data)
	}

	/**
	 * 获取左和右声道的数据
	 *
	 * @returns [DataView]
	 */
	getChannelData(): any {
		const all = this.getPCM()
		const length = all.byteLength
		const { littleEdian } = this
		const res = { left: null, right: null } as { left: DataView | null; right: DataView | null }

		if (this.config.numChannels === 2) {
			// 双通道,劈开
			const lD = new DataView(new ArrayBuffer(length / 2))
			const rD = new DataView(new ArrayBuffer(length / 2))
			// 双声道，需要拆分下数据

			if (this.config.sampleBits === 16) {
				for (let i = 0; i < length / 2; i += 2) {
					lD.setInt16(i, all.getInt16(i * 2, littleEdian), littleEdian)
					rD.setInt16(i, all.getInt16(i * 2 + 2, littleEdian), littleEdian)
				}
			} else {
				for (let i = 0; i < length / 2; i += 2) {
					lD.setInt8(i, all.getInt8(i * 2))
					rD.setInt8(i, all.getInt8(i * 2 + 1))
				}
			}

			res.left = lD
			res.right = rD
		} else {
			// 单通道
			res.left = all
		}

		return res
	}

	/**
	 * 下载录音的wav数据
	 *
	 * @param {string} [name='recorder']    重命名的名字
	 * @memberof Recorder
	 */
	downloadWAV(name: string = "recorder"): void {
		// console.log("对比长度：",this.cacheBuffer.length, this.lBuffer.length)
		const wavBlob = this.getWAVBlob()

		downloadWAV(wavBlob, name)
	}

	/**
	 * 下载缓存的wav数据（调试数据是否正常传输）
	 */
	downloadCacheWAV(name = "once-recorder"): void {
		// console.log("对比长度：",this.cacheBuffer.length, this.lBuffer.length)
		const totalLength = this.cacheBuffer.reduce((total, segment) => total + segment.length, 0)
		const lData = new Float32Array(totalLength)
		const rData = new Float32Array(0)
		let offset = 0
		for (let i = 0; i < this.cacheBuffer.length; i += 1) {
			lData.set(this.cacheBuffer[i], offset)
			offset += this.cacheBuffer[i].length
		}
		const wavBlob = this.getWavBlobByData({
			left: lData,
			right: rData,
		})

		downloadWAV(wavBlob, name)
	}

	/**
	 * 通用的下载接口
	 */
	download(blob: Blob[], name: string, type: string): void {
		download(blob, name, type)
	}
}

export default Recorder
