export type ServiceFactory<T = any> = (container: Container) => T | Promise<T>

export interface Container {
	registerFactory<T>(name: string, factory: ServiceFactory<T>): Container
	register<T>(name: string, instance: T): Container
	get<T>(name: string): T
}

export class ServiceContainer implements Container {
	private services: Record<string, any> = {}

	private factories: Record<string, ServiceFactory> = {}

	// 注册服务工厂
	registerFactory<T>(name: string, factory: ServiceFactory<T>): Container {
		this.factories[name] = factory
		return this
	}

	// 直接注册服务实例
	register<T>(name: string, instance: T): Container {
		this.services[name] = instance
		return this
	}

	// 获取服务实例（支持懒加载）
	get<T>(name: string): T {
		if (!this.services[name] && this.factories[name]) {
			this.services[name] = this.factories[name](this)
		}

		if (!this.services[name]) {
			throw new Error(`服务 "${name}" 未注册`)
		}

		return this.services[name] as T
	}

	// 检查服务是否已注册
	has(name: string): boolean {
		return name in this.services || name in this.factories
	}

	// 重置容器
	reset(): void {
		this.services = {}
	}

	// 移除特定服务
	remove(name: string): void {
		delete this.services[name]
	}
}
