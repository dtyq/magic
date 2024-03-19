import type { MagicConfig } from "../types.magic"
import type { Canvas } from "./Canvas"

/**
 * MagicConfigManager
 * 统一管理 magic 相关配置(methods 和 permissions)
 */
export class MagicConfigManager {
	public config?: MagicConfig

	constructor(options: { canvas: Canvas; config?: MagicConfig }) {
		const { config } = options
		this.update(config)
	}

	update(config?: MagicConfig): void {
		this.config = config
	}
}
