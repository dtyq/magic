import { getNestedIframeInterceptorScript } from "./nested-iframe-content"

// Cookie 模拟实现脚本
const getCookieMockScript = () => {
	return `
		// Cookie存储变量
		if (typeof memoryCookies === 'undefined') {
			var memoryCookies = {};
		}
		
		// 模拟实现 cookie (WebView 中 document.cookie 可能不可配置，需 try-catch)
		function setupCookieMock() {
			try {
				// 解析cookie字符串为对象
				function parseCookieString(cookieStr) {
					const cookies = {};
					if (!cookieStr) return cookies;
					
					cookieStr.split(';').forEach(pair => {
						const [name, value] = pair.trim().split('=');
						if (name) cookies[name] = decodeURIComponent(value || '');
					});
					return cookies;
				}
				
				// 格式化cookie对象为字符串
				function formatCookies() {
					return Object.entries(memoryCookies)
						.map(([name, data]) => {
							if (data.expires && new Date() > new Date(data.expires)) {
								delete memoryCookies[name];
								return '';
							}
							return \`\${name}=\${encodeURIComponent(data.value)}\`;
						})
						.filter(Boolean)
						.join('; ');
				}
				
				// 覆盖document.cookie的getter和setter
				// 钉钉/WebView 等环境中 document.cookie 可能为 non-configurable，会抛出异常
				Object.defineProperty(document, 'cookie', {
					get: function() {
						return formatCookies();
					},
					set: function(cookieString) {
						const [nameValuePair, ...options] = cookieString.split(';');
						const [name, value] = nameValuePair.trim().split('=');
						
						if (!name) return;
						
						memoryCookies[name] = { value: decodeURIComponent(value || '') };
						
						// 处理cookie选项
						options.forEach(option => {
							const [optName, optValue] = option.trim().split('=');
							const lowerOptName = optName.toLowerCase();
							
							if (lowerOptName === 'expires') {
								memoryCookies[name].expires = optValue;
							} else if (lowerOptName === 'max-age') {
								const seconds = parseInt(optValue);
								if (!isNaN(seconds)) {
									const expireDate = new Date();
									expireDate.setSeconds(expireDate.getSeconds() + seconds);
									memoryCookies[name].expires = expireDate.toUTCString();
								}
							}
							// 在模拟环境中，我们忽略path, domain, secure等选项
						});
						
						return cookieString;
					},
					configurable: true
				});
			} catch (e) {
				// document.cookie 在 WebView/钉钉 等环境中可能不可配置，使用原生 cookie
				console.warn('Cookie mock skipped:', e && e.message);
			}
		}
		
		// 立即执行cookie模拟设置
		setupCookieMock();
	`
}

// Storage 模拟实现脚本
const getStorageMockScript = (markerId?: string) => {
	const markerKey = markerId || "default"
	const storageKey = `MAGIC:iframe:storage:${markerKey}`
	const globalStorageKey = `MAGIC:iframe:storage:global`

	return `
		// 拦截 sessionStorage 和 localStorage (WebView 中可能不可配置，需 try-catch)
		function setupStorageMocks() {
			try {
				const storageKey = "${storageKey}";
				const globalStorageKey = "${globalStorageKey}";
				
				// 获取原始存储对象的引用
				const originalLocalStorage = window.localStorage;
				const originalSessionStorage = window.sessionStorage;
			
			// 获取标记存储数据
			function getMarkerStorage(storageType) {
				const storage = storageType === 'localStorage' ? originalLocalStorage : originalSessionStorage;
				return JSON.parse(storage.getItem(storageKey) || '{}');
			}
			
			// 保存标记存储数据
			function saveMarkerStorage(storageType, markerData) {
				const storage = storageType === 'localStorage' ? originalLocalStorage : originalSessionStorage;
				storage.setItem(storageKey, JSON.stringify(markerData));
			}
			
			// 创建存储对象的工厂函数
			function createStorageProxy(storageType) {
				return {
					getItem: function(key) {
						// 如果请求的是存储键本身，返回 null 避免递归
						if (key === storageKey) {
							return null;
						}
						// 如果请求的是全局存储键，直接使用原始存储
						if (key === globalStorageKey) {
							const storage = storageType === 'localStorage' ? originalLocalStorage : originalSessionStorage;
							return storage.getItem(key);
						}
						const data = getMarkerStorage(storageType);
						return data[key] || null;
					},
					setItem: function(key, value) {
						// 如果尝试设置存储键本身，忽略该操作避免递归
						if (key === storageKey) {
							console.warn('忽略对存储键本身的设置操作:', key);
							return;
						}
						// 如果设置的是全局存储键，直接使用原始存储
						if (key === globalStorageKey) {
							const storage = storageType === 'localStorage' ? originalLocalStorage : originalSessionStorage;
							storage.setItem(key, value);
							return;
						}
						const data = getMarkerStorage(storageType);
						data[key] = String(value);
						saveMarkerStorage(storageType, data);
					},
					removeItem: function(key) {
						// 如果尝试删除存储键本身，忽略该操作
						if (key === storageKey) {
							console.warn('忽略对存储键本身的删除操作:', key);
							return;
						}
						// 如果删除的是全局存储键，直接使用原始存储
						if (key === globalStorageKey) {
							const storage = storageType === 'localStorage' ? originalLocalStorage : originalSessionStorage;
							storage.removeItem(key);
							return;
						}
						const data = getMarkerStorage(storageType);
						delete data[key];
						saveMarkerStorage(storageType, data);
					},
					clear: function() {
						saveMarkerStorage(storageType, {});
					},
					key: function(index) {
						const data = getMarkerStorage(storageType);
						const keys = Object.keys(data);
						return keys[index] || null;
					},
					get length() {
						const data = getMarkerStorage(storageType);
						return Object.keys(data).length;
					}
				};
			}

			// 创建模拟的存储对象
			const localStorageInjected = createStorageProxy('localStorage');
			const sessionStorageInjected = createStorageProxy('sessionStorage');

			// 替换全局 sessionStorage
			Object.defineProperty(window, 'sessionStorage', {
				value: sessionStorageInjected,
				writable: false,
				configurable: true
			});
			
			// 替换全局 localStorage
			Object.defineProperty(window, 'localStorage', {
				value: localStorageInjected,
				writable: false,
				configurable: true
			});
			} catch (e) {
				// sessionStorage/localStorage 在 WebView/钉钉 等环境中可能不可配置
				console.warn('Storage mock skipped:', e && e.message);
			}
		}
		
		// 立即执行存储模拟设置
		setupStorageMocks();
	`
}

// IndexedDB 模拟实现脚本
const getIndexedDBMockScript = () => {
	return `
		// IndexedDB存储变量
		if (typeof memoryIndexedDB === 'undefined') {
			var memoryIndexedDB = {
				databases: {},
				currentDb: null
			};
		}
		
		// 模拟 IndexedDB API (WebView 中可能不可配置，需 try-catch)
		function setupIndexedDBMock() {
			try {
			// 模拟 IDBFactory (window.indexedDB 对象)
			const mockIDBFactory = {
				open: function(name, version) {
					const request = new EventTarget();
					request.result = null;

					// 使用 setTimeout 模拟异步操作
					setTimeout(() => {
						// 如果数据库不存在，则创建
						if (!memoryIndexedDB.databases[name]) {
							memoryIndexedDB.databases[name] = {
								name: name,
								version: version || 1,
								objectStores: {}
							};
						}

						memoryIndexedDB.currentDb = memoryIndexedDB.databases[name];
						request.result = {
							name: memoryIndexedDB.currentDb.name,
							version: memoryIndexedDB.currentDb.version,
							objectStoreNames: {
								contains: function(name) {
									return name in memoryIndexedDB.currentDb.objectStores;
								},
								item: function(index) {
									return Object.keys(memoryIndexedDB.currentDb.objectStores)[index] || null;
								},
								get length() {
									return Object.keys(memoryIndexedDB.currentDb.objectStores).length;
								}
							},
							createObjectStore: function(name, options) {
								const store = {
									name: name,
									keyPath: options?.keyPath,
									autoIncrement: options?.autoIncrement || false,
									data: {},
									getAll: function() {
										return Object.values(this.data);
									},
									get: function(key) {
										return this.data[key] || null;
									},
									put: function(value, key) {
										const useKey = this.keyPath ? value[this.keyPath] : key;
										this.data[useKey] = value;
										return useKey;
									},
									delete: function(key) {
										delete this.data[key];
									},
									clear: function() {
										this.data = {};
									}
								};
								memoryIndexedDB.currentDb.objectStores[name] = store;
								return store;
							},
							transaction: function(storeNames, mode) {
								return {
									objectStore: function(name) {
										return memoryIndexedDB.currentDb.objectStores[name];
									}
								};
							}
						};

						// 触发成功事件
						const successEvent = new Event('success');
						request.dispatchEvent(successEvent);
					}, 0);

					return request;
				},
				deleteDatabase: function(name) {
					const request = new EventTarget();
					
					setTimeout(() => {
						delete memoryIndexedDB.databases[name];
						
						const successEvent = new Event('success');
						request.dispatchEvent(successEvent);
					}, 0);
					
					return request;
				}
			};

			// 替换全局 indexedDB
			Object.defineProperty(window, 'indexedDB', {
				value: mockIDBFactory,
				writable: false,
				configurable: true
			});
			} catch (e) {
				// indexedDB 在 WebView/钉钉 等环境中可能不可配置
				console.warn('IndexedDB mock skipped:', e && e.message);
			}
		}
		
		// 立即执行IndexedDB模拟设置
		setupIndexedDBMock();
	`
}

// ServiceWorker 模拟实现脚本
const getServiceWorkerMockScript = () => {
	return `
		// 模拟 ServiceWorker API (WebView 中可能不可配置，需 try-catch)
		function setupServiceWorkerMock() {
			try {
			// 创建模拟的 ServiceWorkerContainer
			const mockServiceWorkerContainer = {
				// 模拟注册服务工作线程
				register: function(scriptURL, options) {
					return Promise.resolve({
						// 模拟 ServiceWorkerRegistration
						scope: options?.scope || '/',
						active: {
							state: 'activated',
							addEventListener: function() {},
							removeEventListener: function() {}
						},
						installing: null,
						waiting: null,
						update: function() {
							return Promise.resolve();
						},
						unregister: function() {
							return Promise.resolve(true);
						},
						addEventListener: function() {},
						removeEventListener: function() {}
					});
				},
				// 获取现有的注册
				getRegistration: function() {
					return Promise.resolve(null);
				},
				getRegistrations: function() {
					return Promise.resolve([]);
				},
				// 控制当前页面的服务工作线程
				controller: null,
				ready: Promise.resolve({
					scope: '/',
					active: {
						state: 'activated'
					},
					unregister: function() {
						return Promise.resolve(true);
					}
				}),
				// 添加必要的事件监听方法
				addEventListener: function() {},
				removeEventListener: function() {},
				dispatchEvent: function() { return true; }
			};

			// 替换全局 navigator.serviceWorker
			Object.defineProperty(navigator, 'serviceWorker', {
				value: mockServiceWorkerContainer,
				writable: false,
				configurable: true
			});
			} catch (e) {
				// navigator.serviceWorker 在 WebView/钉钉 等环境中可能不可配置
				console.warn('ServiceWorker mock skipped:', e && e.message);
			}
		}
		
		// 立即执行ServiceWorker模拟设置
		setupServiceWorkerMock();
	`
}

// 超级麦吉 logo fallback
// export const fallbackImageBase64 =
// 	"data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMSIgdmlld0JveD0iMCAwIDEwMCAxMDEiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSIxMDAiIGhlaWdodD0iMTAwIiB0cmFuc2Zvcm09InRyYW5zbGF0ZSgwIDAuNjQ0NTMxKSIgZmlsbD0iI0Y1RjVGNSIvPgo8ZyBjbGlwLXBhdGg9InVybCgjY2xpcDBfMTUyM18xMDc1KSI+CjxwYXRoIGZpbGwtcnVsZT0iZXZlbm9kZCIgY2xpcC1ydWxlPSJldmVub2RkIiBkPSJNMjYuOTMxNCAzMi4xNDEyQzI2LjM0ODUgMzMuMjgyMyAyNS44MDc2IDM0Ljk0MjQgMjUuNDQ0NCAzNy4wODEyQzI0Ljk1MzggMzkuOTcwMiAyNC44NDgzIDQzLjM3NjMgMjUuMjExMyA0Ni43NTg3QzI1LjU3NTQgNTAuMTUxMSAyNi4zOTUzIDUzLjM3ODUgMjcuNjU1MiA1NS45NzA1QzI3LjkzNzcgNTYuNTUxOCAyOC4yMzY1IDU3LjA4OTYgMjguNTUgNTcuNTgzOEMyOC41NTEgNTcuMjgzIDI4LjU1MzQgNTYuOTgwMSAyOC41NTU5IDU2LjY3N0MyOC41NTY3IDU2LjU3OSAyOC41NTc1IDU2LjQ4MDkgMjguNTU4MyA1Ni4zODI5QzI4LjU2MTUgNTUuOTUyMiAyOC41NjQ0IDU1LjU3IDI4LjU2NDQgNTUuMjM0QzI4LjU2NDQgNTMuNzYzIDI4LjcyMzMgNTEuMjQ5MSAzMC4zMzY3IDQ5LjA4NzlDMzIuMDg3MiA0Ni43NDI5IDM0Ljk3NDUgNDUuNTI3NSAzOC44NzQ4IDQ1LjUyNzVINDMuNTkzOUM0MS41Mjg4IDQyLjkzMjMgMzguMjE4IDM5LjI5ODUgMzQuNjk1NCAzNi40Mjc3QzMyLjg0NTEgMzQuOTE5OCAzMS4wMzI5IDMzLjcwMjEgMjkuMzkwNyAzMi45Mzg5QzI4LjQwNTQgMzIuNDgxIDI3LjU5IDMyLjIzNyAyNi45MzE0IDMyLjE0MTJaTTU5LjMyNTEgNDUuNTI3NUg2NC4wNDQyQzY3Ljk0NDUgNDUuNTI3NSA3MC44MzE3IDQ2Ljc0MjkgNzIuNTgyMyA0OS4wODc5Qzc0LjE5NTcgNTEuMjQ5MSA3NC4zNTQ1IDUzLjc2MyA3NC4zNTQ1IDU1LjIzNEM3NC4zNTQ1IDU1LjU3IDc0LjM1NzQgNTUuOTUyMiA3NC4zNjA3IDU2LjM4MjlDNzQuMzYxNSA1Ni40ODA5IDc0LjM2MjMgNTYuNTc4OSA3NC4zNjMxIDU2LjY3NjlDNzQuMzY1NiA1Ni45ODAxIDc0LjM2OCA1Ny4yODI5IDc0LjM2ODkgNTcuNTgzOEM3NC42ODI1IDU3LjA4OTYgNzQuOTgxMiA1Ni41NTE4IDc1LjI2MzggNTUuOTcwNUM3Ni41MjM3IDUzLjM3ODUgNzcuMzQzNiA1MC4xNTExIDc3LjcwNzcgNDYuNzU4N0M3OC4wNzA3IDQzLjM3NjMgNzcuOTY1MiAzOS45NzAyIDc3LjQ3NDYgMzcuMDgxMkM3Ny4xMTE0IDM0Ljk0MjQgNzYuNTcwNSAzMy4yODIzIDc1Ljk4NzYgMzIuMTQxMkM3NS4zMjkgMzIuMjM3IDc0LjUxMzYgMzIuNDgxIDczLjUyODMgMzIuOTM4OUM3MS44ODYxIDMzLjcwMjEgNzAuMDczOSAzNC45MTk4IDY4LjIyMzYgMzYuNDI3N0M2NC43MDEgMzkuMjk4NSA2MS4zOTAxIDQyLjkzMjMgNTkuMzI1MSA0NS41Mjc1Wk02OS40MzUzIDY3LjIwMjFDNjkuMDYwMSA2Ny4zNDI5IDY4LjY3NjEgNjcuNDY1NCA2OC4yOTMyIDY3LjU3MjFDNjYuNzkzNyA2Ny45OTAxIDY1LjA1MDEgNjguMjM3NyA2My4zMzYxIDY4LjI5OTdDNjEuNjI5OSA2OC4zNjE0IDU5LjgwMTggNjguMjQ0OSA1OC4xNTkxIDY3Ljg0MzJDNTYuNjM0IDY3LjQ3MDIgNTQuNjgxNyA2Ni43MSA1My40NjkyIDY1LjAyMUM1Mi44OTA0IDY0LjIxNDggNTIuMzU2MyA2My44NjQ5IDUyLjAzODQgNjMuNzE0N0M1MS44OTkgNjMuNjQ4OCA1MS43OTMyIDYzLjYxNzUgNTEuNzMxMiA2My42MDMzTDUxLjQ1OTUgNjMuNjQwNkw1MS4xODc4IDYzLjYwMzNDNTEuMTI1OCA2My42MTc1IDUxLjAyIDYzLjY0ODggNTAuODgwNiA2My43MTQ3QzUwLjU2MjcgNjMuODY0OSA1MC4wMjg1IDY0LjIxNDggNDkuNDQ5OCA2NS4wMjFDNDguMjM3MyA2Ni43MSA0Ni4yODUgNjcuNDcwMiA0NC43NTk5IDY3Ljg0MzJDNDMuMTE3MiA2OC4yNDQ5IDQxLjI4OTEgNjguMzYxNCAzOS41ODI5IDY4LjI5OTdDMzcuODY4OSA2OC4yMzc3IDM2LjEyNTMgNjcuOTkwMSAzNC42MjU4IDY3LjU3MjFDMzQuMjQyOSA2Ny40NjU0IDMzLjg1ODkgNjcuMzQyOSAzMy40ODM3IDY3LjIwMjFDMzMuMTQ2OCA2OC41ODYxIDMyLjg0MjIgNjkuNjMwNCAzMi41NzE0IDcwLjQwOTVMMzIuNTcwOCA3MC40MTExQzM1LjQ0NTkgNzMuNzM1OCA0MS45Nzc3IDc4LjcwMDkgNTEuMzc0NiA3OC40NDg0TDUxLjQ1OTUgNzguNDQ2MUw1MS41NDQ0IDc4LjQ0ODRDNjAuOTQxMiA3OC43MDA5IDY3LjQ3MzEgNzMuNzM1OCA3MC4zNDgyIDcwLjQxMTFMNzAuMzQ3NiA3MC40MDk1QzcwLjA3NjggNjkuNjMwNCA2OS43NzIyIDY4LjU4NjEgNjkuNDM1MyA2Ny4yMDIxWk0yNy4zODMgNjUuNTQyMUMyNS4wMTU2IDYzLjgwNDcgMjMuMjUxMyA2MS4zNjc5IDIxLjk3MTggNTguNzM1NkMyMC4zMTIgNTUuMzIwOSAxOS4zNDcxIDUxLjM0MjggMTguOTI3NiA0Ny40MzM3QzE4LjUwNyA0My41MTQ4IDE4LjYxOTIgMzkuNTIzNSAxOS4yMTM4IDM2LjAyMjJDMTkuNzkyMyAzMi42MTU3IDIwLjg5MjQgMjkuMjg0NCAyMi43NDkxIDI3LjAyMkwyMy40ODMyIDI2LjEyNzZMMjQuNjIwOSAyNS45MTg3QzI3LjIwNzIgMjUuNDQzOSAyOS44MDU0IDI2LjE2MDEgMzIuMDUzMyAyNy4yMDQ4QzM0LjM0MzMgMjguMjY5MSAzNi42MDkzIDI5LjgzMjYgMzguNjg2OCAzMS41MjU3QzQyLjAzMyAzNC4yNTI3IDQ1LjE0MDQgMzcuNTIyOSA0Ny4zOTU1IDQwLjE5NjNDNDcuODAyOCA0MC4wOTkgNDguMTg3NCA0MC4wMjkxIDQ4LjUyNjUgMzkuOTc3QzQ5LjY0NDggMzkuODA0OSA1MC43MjMyIDM5Ljc2MTggNTEuNDU5NSAzOS43NzgxQzUyLjE5NTggMzkuNzYxOCA1My4yNzQyIDM5LjgwNDkgNTQuMzkyNSAzOS45NzdDNTQuNzMxNSA0MC4wMjkxIDU1LjExNjIgNDAuMDk5IDU1LjUyMzUgNDAuMTk2M0M1Ny43Nzg2IDM3LjUyMjkgNjAuODg2IDM0LjI1MjcgNjQuMjMyMiAzMS41MjU3QzY2LjMwOTcgMjkuODMyNiA2OC41NzU3IDI4LjI2OTEgNzAuODY1NyAyNy4yMDQ4QzczLjExMzYgMjYuMTYwMSA3NS43MTE4IDI1LjQ0MzkgNzguMjk4IDI1LjkxODdMNzkuNDM1OCAyNi4xMjc2TDgwLjE2OTkgMjcuMDIyQzgyLjAyNjYgMjkuMjg0NCA4My4xMjY3IDMyLjYxNTcgODMuNzA1MiAzNi4wMjIyQzg0LjI5OTcgMzkuNTIzNSA4NC40MTIgNDMuNTE0OCA4My45OTE0IDQ3LjQzMzdDODMuNTcxOSA1MS4zNDI4IDgyLjYwNyA1NS4zMjA5IDgwLjk0NzIgNTguNzM1NkM3OS42Njc3IDYxLjM2NzkgNzcuOTAzNCA2My44MDQ3IDc1LjUzNiA2NS41NDIxQzc1Ljc4MSA2Ni41NjE4IDc1Ljk5MzEgNjcuMzI0MiA3Ni4xNjgxIDY3Ljg4MTZMNzkuMzk5MiA2OC4zNTYxTDc2LjY5IDcyLjQ5NjZDNzMuNzk4NCA3Ni45MTU1IDY0Ljk0NTQgODUuMDk4MSA1MS40NTk1IDg0Ljc3MDlDMzcuOTczNiA4NS4wOTgxIDI5LjEyMDUgNzYuOTE1NSAyNi4yMjkgNzIuNDk2NkwyMy41MTk4IDY4LjM1NjFMMjYuNzUwOCA2Ny44ODE2QzI2LjkyNTkgNjcuMzI0MiAyNy4xMzc5IDY2LjU2MTggMjcuMzgzIDY1LjU0MjFaTTM1LjQwMDIgNTIuODcxM0MzNS4wNTkxIDUzLjMyODEgMzQuODg0MyA1NC4wODY5IDM0Ljg4NDMgNTUuMjM0QzM0Ljg4NDMgNTUuNTk2NiAzNC44ODEyIDU2LjAwMTcgMzQuODc4IDU2LjQyMjhMMzQuODc3OSA1Ni40MzEyQzM0Ljg2NDYgNTguMTcxNCAzNC44NTcyIDU5LjIyMzQgMzQuOTYyNSA2MC4wNDgzQzM1LjAzNCA2MC42MDgyIDM1LjE0MDUgNjAuODk0NiAzNS4yNTU3IDYxLjA4NDNDMzUuMjcwOSA2MS4wOTI2IDM1LjI4ODEgNjEuMTAxNyAzNS4zMDc2IDYxLjExMTZDMzUuNTEzNiA2MS4yMTY2IDM1Ljg0ODMgNjEuMzQ5NSAzNi4zMjE5IDYxLjQ4MTVDMzcuMjY4NCA2MS43NDUzIDM4LjUxMDEgNjEuOTM0MSAzOS44MTEzIDYxLjk4MTJDNDEuMTIwMSA2Mi4wMjg2IDQyLjMzNjkgNjEuOTI2OSA0My4yNTk0IDYxLjcwMTRDNDQuMDk1NSA2MS40OTY5IDQ0LjM0NTYgNjEuMjc4NCA0NC4zNTEzIDYxLjI4NDZDNDYuNTI2NyA1OC4yODQ0IDQ5LjM3MjkgNTcuMTc1IDUxLjQ1OTUgNTcuMjc4MUM1My41NDYxIDU3LjE3NSA1Ni4zOTIyIDU4LjI4NDUgNTguNTY3NyA2MS4yODQ3QzU4LjU3MzMgNjEuMjc4NiA1OC44MjM1IDYxLjQ5NjkgNTkuNjU5NiA2MS43MDE0QzYwLjU4MjEgNjEuOTI2OSA2MS43OTg5IDYyLjAyODYgNjMuMTA3NyA2MS45ODEyQzY0LjQwODkgNjEuOTM0MSA2NS42NTA2IDYxLjc0NTMgNjYuNTk3MSA2MS40ODE1QzY3LjA3MDcgNjEuMzQ5NSA2Ny40MDU0IDYxLjIxNjYgNjcuNjExNCA2MS4xMTE2QzY3LjYzMDggNjEuMTAxNyA2Ny42NDgxIDYxLjA5MjYgNjcuNjYzMyA2MS4wODQzQzY3Ljc3ODUgNjAuODk0NiA2Ny44ODUgNjAuNjA4MiA2Ny45NTY1IDYwLjA0ODNDNjguMDYxOCA1OS4yMjM0IDY4LjA1NDQgNTguMTcxNCA2OC4wNDExIDU2LjQzMTJMNjguMDQxIDU2LjQyMjFDNjguMDM3OCA1Ni4wMDEyIDY4LjAzNDcgNTUuNTk2NCA2OC4wMzQ3IDU1LjIzNEM2OC4wMzQ3IDU0LjA4NjkgNjcuODU5OSA1My4zMjgxIDY3LjUxODggNTIuODcxM0M2Ny4zMTUgNTIuNTk4MiA2Ni42MjcgNTEuODUwMSA2NC4wNDQyIDUxLjg1MDFIMzguODc0OEMzNi4yOTIgNTEuODUwMSAzNS42MDQgNTIuNTk4MiAzNS40MDAyIDUyLjg3MTNaIiBmaWxsPSIjRTlFOUU5Ii8+CjxwYXRoIGQ9Ik0xMy40MDM2IDI5LjM2MTZDMTMuNzI5NiAyOS45MjQ2IDE0LjU5MDYgMjkuNjkzOSAxNC41OTE0IDI5LjA0MzNMMTQuNTk2IDI1LjI4MDVDMTQuNTk2MiAyNS4wNTM2IDE0LjcxNzMgMjQuODQzOSAxNC45MTM3IDI0LjczMDJMMTguMTcgMjIuODQ0OUMxOC43MzMxIDIyLjUxODkgMTguNTAyNCAyMS42NTc5IDE3Ljg1MTggMjEuNjU3MUwxNC4wODkgMjEuNjUyNUMxMy44NjIxIDIxLjY1MjMgMTMuNjUyNCAyMS41MzEyIDEzLjUzODcgMjEuMzM0OEwxMS42NTM0IDE4LjA3ODVDMTEuMzI3NCAxNy41MTU0IDEwLjQ2NjQgMTcuNzQ2MSAxMC40NjU2IDE4LjM5NjdMMTAuNDYxIDIyLjE1OTVDMTAuNDYwNyAyMi4zODY0IDEwLjMzOTcgMjIuNTk2MSAxMC4xNDMzIDIyLjcwOThMNi44ODY5MyAyNC41OTUxQzYuMzIzODUgMjQuOTIxMSA2LjU1NDU2IDI1Ljc4MjEgNy4yMDUyIDI1Ljc4MjlMMTAuOTY4IDI1Ljc4NzVDMTEuMTk0OSAyNS43ODc4IDExLjQwNDUgMjUuOTA4OCAxMS41MTgzIDI2LjEwNTJMMTMuNDAzNiAyOS4zNjE2WiIgZmlsbD0iI0U5RTlFOSIvPgo8cGF0aCBkPSJNODguNjA1NyA3MS4xMTc0Qzg4LjYwNjIgNzEuNTUxMiA4OS4xODAyIDcxLjcwNSA4OS4zOTc1IDcxLjcyOTZMOTAuNjU0NCA2OS4xNTg3QzkwLjczMDIgNjkuMDI3OCA5MC44NyA2OC45NDcxIDkxLjAyMTMgNjguOTQ2OUw5My41Mjk4IDY4Ljk0MzlDOTMuOTYzNSA2OC45NDMzIDk0LjExNzQgNjguMzY5MyA5My43NDIgNjguMTUyTDkxLjU3MTEgNjYuODk1MUM5MS40NDAxIDY2LjgxOTMgOTEuMzU5NCA2Ni42Nzk1IDkxLjM1OTIgNjYuNTI4Mkw5MS4zNTYyIDY0LjAxOTdDOTEuMzU1NyA2My41ODYgOTAuNzgxNyA2My40MzIyIDkwLjU2NDMgNjMuODA3NUw4OS4zMDc0IDY1Ljk3ODVDODkuMjMxNiA2Ni4xMDk0IDg5LjA5MTkgNjYuMTkwMSA4OC45NDA2IDY2LjE5MDNMODYuNDMyMSA2Ni4xOTMzQzg1Ljk5ODMgNjYuMTkzOCA4NS44NDQ1IDY2Ljc2NzggODYuMjE5OSA2Ni45ODUyTDg4LjM5MDggNjguMjQyMUM4OC41MjE3IDY4LjMxNzkgODguNjAyNCA2OC40NTc2IDg4LjYwMjYgNjguNjA4OUw4OC42MDU3IDcxLjExNzRaIiBmaWxsPSIjRTlFOUU5Ii8+CjwvZz4KPGRlZnM+CjxjbGlwUGF0aCBpZD0iY2xpcDBfMTUyM18xMDc1Ij4KPHJlY3QgeD0iNSIgeT0iNS42NDQ1MyIgd2lkdGg9IjkwIiBoZWlnaHQ9IjkwIiByeD0iNC43NDA3NCIgZmlsbD0id2hpdGUiLz4KPC9jbGlwUGF0aD4KPC9kZWZzPgo8L3N2Zz4K"

export const fallbackImageBase64 =
	"data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiB2aWV3Qm94PSIwIDAgMjAwIDIwMCIgcHJlc2VydmVBc3BlY3RSYXRpbz0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgZmlsbD0iI2YzZjRmNiIvPjxzdmcgeD0iNzUiIHk9Ijc1IiB3aWR0aD0iNTAiIGhlaWdodD0iNTAiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgc3Ryb2tlPSIjOWNhM2FmIiBzdHJva2Utd2lkdGg9IjIiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIgc3Ryb2tlLWxpbmVqb2luPSJyb3VuZCI+PHJlY3Qgd2lkdGg9IjE4IiBoZWlnaHQ9IjE4IiB4PSIzIiB5PSIzIiByeD0iMiIgcnk9IjIiLz48Y2lyY2xlIGN4PSI5IiBjeT0iOSIgcj0iMiIvPjxwYXRoIGQ9Im0yMSAxNS0zLjA4Ni0zLjA4NmEyIDIgMCAwIDAtMi44MjggMEw2IDIxIi8+PC9zdmc+PC9zdmc+"

// DOM 内容加载后的处理脚本
const getDOMContentLoadedScript = () => {
	return `
		// 在HTML内容内直接注入脚本，避免跨域访问
		document.addEventListener("DOMContentLoaded", function() {
			// 空状态占位图的 base64 SVG
			const emptyStateSvg = "${fallbackImageBase64}"

			// 给所有图片添加 onerror 处理
			function handleImageError() {
				document.querySelectorAll("img").forEach(img => {
					if (!img.hasAttribute("data-listener-added")) {
						img.addEventListener("error", function() {
							// 保存原始尺寸信息
							const originalWidth = this.style.width || this.getAttribute('width') || this.offsetWidth;
							const originalHeight = this.style.height || this.getAttribute('height') || this.offsetHeight;
							
							// 保存原始src到data-src属性（仅当不是占位图时）
							if (this.src && this.src !== emptyStateSvg && !this.hasAttribute('data-src')) {
								this.setAttribute('data-src', this.src);
							}
							
							// 替换为占位图
							this.src = emptyStateSvg;
							
							// 保持原始尺寸，如果有的话
							if (originalWidth && originalWidth !== '0' && originalWidth !== 0) {
								this.style.width = typeof originalWidth === 'number' ? originalWidth + 'px' : originalWidth;
							}
							if (originalHeight && originalHeight !== '0' && originalHeight !== 0) {
								this.style.height = typeof originalHeight === 'number' ? originalHeight + 'px' : originalHeight;
							}
							
							// 如果没有明确的尺寸，添加默认样式确保SVG能够合理显示
							if ((!originalWidth || originalWidth === '0' || originalWidth === 0) &&
							    (!originalHeight || originalHeight === '0' || originalHeight === 0)) {
							
							}
							
							// 确保SVG能够正确缩放
							this.style.objectFit = 'contain';
							
							this.setAttribute("data-error-handled", "true");
						});
						img.setAttribute("data-listener-added", "true");
					}
				});
			}

			// 初始处理已存在的图片
			handleImageError();

		// 给所有链接添加target属性
		document.querySelectorAll("a").forEach(link => {
			const href = link.getAttribute("href");
			// 检查是否为锚点链接（以#开头）
			if (href && href.startsWith("#")) {
				// 为锚点链接添加点击事件处理
				link.addEventListener("click", function(e) {
					// 动态检查当前的href值，因为可能被JavaScript修改
					const currentHref = this.getAttribute("href");
					// 只有当前仍然是锚点链接时才阻止默认行为
					if (currentHref && currentHref.startsWith("#")) {
						const targetId = currentHref.substring(1);
						const targetElement = document.getElementById(targetId);
						if (targetElement) {
							// 目标元素存在时阻止默认行为
							e.preventDefault();
							// 滚动到目标元素
							targetElement.scrollIntoView({ behavior: "smooth" });
							// 替换历史记录
							if (window.history && window.history.replaceState) {
								window.history.replaceState(null, "", currentHref);
							} else {
								window.location.hash = currentHref;
							}
						}
					}
					// 如果href已被修改为其他值（如http://），则不阻止，让浏览器正常处理
				});
			} else {
				// 非锚点链接在新窗口打开
				link.setAttribute("target", "_blank");
				link.setAttribute("rel", "noopener noreferrer");
			}
		});

			// 捕获并处理脚本错误
			window.onerror = function(message, source, lineno, colno, error) {
				console.error(message);
			};

		    document.addEventListener("click", function(event) {
                window.parent.postMessage({
                    type: "DOM_CLICK",
                    data: {}
                }, "*")
			})
		});
	`
}

// MAGIC 方法集脚本 - 提供安全的页面操作方法
const getMagicMethodsScript = () => {
	return `
		// 初始化 window.Magic 方法集
		if (typeof window.Magic === 'undefined') {
			window.Magic = {};
		}
		
		// 添加 reload 方法，通过 postMessage 通知父窗口重新加载内容
		window.Magic.reload = function() {
			window.parent.postMessage({
				type: "MAGIC_RELOAD_REQUEST",
				timestamp: Date.now()
			}, "*");
		};
		
		// 添加 setInputMessage 方法，通过 postMessage 通知父窗口设置输入框文本
		window.Magic.setInputMessage = function(message) {
			if (typeof message !== 'string') {
				console.error('window.Magic.setInputMessage: message must be a string');
				return;
			}
			window.parent.postMessage({
				type: "MAGIC_SET_INPUT_MESSAGE",
				message: message,
				timestamp: Date.now()
			}, "*");
		};
		
		// 添加 uploadFiles 方法，通过 postMessage 通知父窗口上传文件
		window.Magic.uploadFiles = function(files) {
			return new Promise((resolve, reject) => {
				// 验证参数格式
				if (!Array.isArray(files)) {
					reject(new Error('window.Magic.uploadFiles: files must be an array'));
					return;
				}
				
				if (files.length === 0) {
					reject(new Error('window.Magic.uploadFiles: files array cannot be empty'));
					return;
				}
				
				// 验证每个元素格式
				for (let i = 0; i < files.length; i++) {
					const item = files[i];
					if (!item || typeof item !== 'object') {
						reject(new Error(\`window.Magic.uploadFiles: files[\${i}] must be an object\`));
						return;
					}
					if (!(item.file instanceof File)) {
						reject(new Error(\`window.Magic.uploadFiles: files[\${i}].file must be a File object\`));
						return;
					}
					if (typeof item.path !== 'string') {
						reject(new Error(\`window.Magic.uploadFiles: files[\${i}].path must be a string\`));
						return;
					}
					if (typeof item.filename !== 'string') {
						reject(new Error(\`window.Magic.uploadFiles: files[\${i}].filename must be a string\`));
						return;
					}
				}
				
				// 生成请求ID用于匹配响应
				const requestId = 'upload_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
				
				// 转换文件为base64
				const filePromises = files.map((item) => {
					return new Promise((resolveFile, rejectFile) => {
						const reader = new FileReader();
						reader.onload = () => {
							resolveFile({
								base64: reader.result,
								filename: item.filename,
								path: item.path,
								fileSize: item.file.size,
								fileType: item.file.type
							});
						};
						reader.onerror = () => {
							rejectFile(new Error('Failed to read file: ' + item.filename));
						};
						reader.readAsDataURL(item.file);
					});
				});
				
				// 等待所有文件转换完成
				Promise.all(filePromises)
					.then((fileData) => {
						// 发送上传请求到父窗口
						window.parent.postMessage({
							type: "MAGIC_UPLOAD_FILES_REQUEST",
							requestId: requestId,
							files: fileData
						}, "*");
						
						// 监听响应
						const messageHandler = (event) => {
							if (event.data && 
								event.data.type === "MAGIC_UPLOAD_FILES_RESPONSE" && 
								event.data.requestId === requestId) {
								window.removeEventListener('message', messageHandler);
								
								if (event.data.success) {
									resolve(event.data.results);
								} else {
									reject(new Error(event.data.error || 'Upload failed'));
								}
							}
						};
						
						window.addEventListener('message', messageHandler);
					})
					.catch((error) => {
						reject(error);
					});
			});
		};
		
		// 添加 addFilesToMessage 方法，通过 postMessage 通知父窗口将文件添加到消息对话框
		window.Magic.addFilesToMessage = function(filePaths, agentMode) {
			return new Promise((resolve, reject) => {
				// 验证参数格式
				if (!Array.isArray(filePaths)) {
					reject(new Error('window.Magic.addFilesToMessage: filePaths must be an array'));
					return;
				}
				
				if (filePaths.length === 0) {
					reject(new Error('window.Magic.addFilesToMessage: filePaths array cannot be empty'));
					return;
				}
				
				// 验证每个路径都是字符串
				for (let i = 0; i < filePaths.length; i++) {
					if (typeof filePaths[i] !== 'string') {
						reject(new Error(\`window.Magic.addFilesToMessage: filePaths[\${i}] must be a string\`));
						return;
					}
				}
				
				// 验证 agentMode（如果提供）
				if (agentMode !== undefined && typeof agentMode !== 'string') {
					reject(new Error('window.Magic.addFilesToMessage: agentMode must be a string'));
					return;
				}
				
				// 生成请求ID用于匹配响应
				const requestId = 'add_files_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
				
				// 发送请求到父窗口
				window.parent.postMessage({
					type: "MAGIC_ADD_FILES_TO_MESSAGE_REQUEST",
					requestId: requestId,
					filePaths: filePaths,
					agentMode: agentMode
				}, "*");
				
				// 监听响应
				const messageHandler = (event) => {
					if (event.data && 
						event.data.type === "MAGIC_ADD_FILES_TO_MESSAGE_RESPONSE" && 
						event.data.requestId === requestId) {
						window.removeEventListener('message', messageHandler);
						
						if (event.data.success) {
							resolve(event.data.result);
						} else {
							reject(new Error(event.data.error || 'Add files to message failed'));
						}
					}
				};
				
				window.addEventListener('message', messageHandler);
			});
		};
		
		// 添加 downloadFiles 方法，通过 postMessage 通知父窗口下载文件
		window.Magic.downloadFiles = function(filePaths) {
			return new Promise((resolve, reject) => {
				// 验证参数格式
				if (!Array.isArray(filePaths)) {
					reject(new Error('window.Magic.downloadFiles: filePaths must be an array'));
					return;
				}
				
				if (filePaths.length === 0) {
					reject(new Error('window.Magic.downloadFiles: filePaths array cannot be empty'));
					return;
				}
				
				// 验证每个路径都是字符串
				for (let i = 0; i < filePaths.length; i++) {
					if (typeof filePaths[i] !== 'string') {
						reject(new Error(\`window.Magic.downloadFiles: filePaths[\${i}] must be a string\`));
						return;
					}
				}
				
				// 生成请求ID用于匹配响应
				const requestId = 'download_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
				
				// 发送请求到父窗口
				window.parent.postMessage({
					type: "MAGIC_DOWNLOAD_FILES_REQUEST",
					requestId: requestId,
					filePaths: filePaths
				}, "*");
				
				// 监听响应
				const messageHandler = (event) => {
					if (event.data && 
						event.data.type === "MAGIC_DOWNLOAD_FILES_RESPONSE" && 
						event.data.requestId === requestId) {
						window.removeEventListener('message', messageHandler);
						
						if (event.data.success) {
							resolve(event.data.result);
						} else {
							reject(new Error(event.data.error || 'Download files failed'));
						}
					}
				};
				
				window.addEventListener('message', messageHandler);
			});
		};
	`
}

// 链接处理脚本
const getLinkHandlingScript = () => {
	return `
		// 处理非HTTP链接的点击事件
		document.addEventListener("DOMContentLoaded", function() {
			// 监听所有 a 标签的点击事件
			document.addEventListener("click", function(event) {
				// 检查点击的元素是否是 a 标签或其子元素
				let linkElement = event.target.closest("a");
				
				if (linkElement && linkElement.href) {
					const href = linkElement.getAttribute("href");

					// 检查是否为锚点链接（以#开头）
					if (href && href.startsWith("#")) {
						return;
					}
					
					// 检查 href 是否不是以 http 或 https 开头
					if (href && !href.startsWith("http://") && !href.startsWith("https://")) {
						// 阻止默认行为
						event.preventDefault();
						event.stopPropagation();
						
						// 如果当前是编辑模式，不触发通信
						if (window.slideSelector && window.slideSelector.isEditMode) {
							console.log('编辑模式下不触发链接通信');
							return;
						}
						
						// 检查是否有 data-auto-edit 属性
					const autoEdit = linkElement.getAttribute("data-auto-edit") === "true";
					
					// 通过 postMessage 通知主窗口
					try {
						console.log(href)
						window.parent.postMessage({
							type: "linkClicked",
							href: href,
							originalHref: linkElement.href,
							text: linkElement.textContent || linkElement.innerText || "",
							target: linkElement.target || "",
							autoEdit: autoEdit
						}, "*");
					} catch (error) {
						console.error("发送链接点击消息时出错:", error);
					}
					}
				}
			});

			// 劫持 window.open 方法
			const originalWindowOpen = window.open;
			window.open = function(url, target, features) {
				// 检查 URL 是否不是以 http 或 https 开头
				if (url && !url.startsWith("http://") && !url.startsWith("https://")) {
					// 如果当前是编辑模式，不触发通信
					if (window.slideSelector && window.slideSelector.isEditMode) {
						console.log('编辑模式下不触发 window.open 通信');
						return null;
					}
					
					// 阻止默认行为，不调用原始的 window.open
					try {
						console.log("劫持的 window.open:", url);
						window.parent.postMessage({
							type: "linkClicked",
							href: url,
							originalHref: url,
							text: "",
							target: target || "_blank",
							autoEdit: false // window.open 不支持 data-auto-edit 属性
						}, "*");
					} catch (error) {
						console.error("发送 window.open 消息时出错:", error);
					}
					// 返回一个空的窗口对象引用，防止脚本报错
					return null;
				} else {
					// 对于 HTTP/HTTPS 链接，调用原始的 window.open
					return originalWindowOpen.call(this, url, target, features);
				}
			};
		});
	`
}

/**
 * 生成动态资源拦截器脚本
 * 脚本用于拦截iframe中的相对路径资源，并将其替换为实际的URL
 * 脚本通过postMessage与父容器通信来解析相对路径
 * 脚本特性：
 * - Promise缓存：避免同时发起多个相同URL的请求
 * - 结果缓存：已解析的URL会被缓存，避免重复解析
 * - 错误处理：请求失败时自动清理缓存状态
 * - 文件ID验证：通过fileId确保请求来自正确的iframe
 * @param options - 动态资源拦截器配置选项
 * @param options.enable - 是否启用动态资源拦截器
 * @param options.fileId - 文件ID，用于识别文件，在iframe中设置，用于识别文件
 * @returns 动态资源拦截器脚本
 */
const getDynamicResourceInterceptorScript = (options: DynamicResourceInterceptorOptions = {}) => {
	const { enable = true, fileId = "" } = options

	return `
		(function() {
			var isEnabled = ${enable ? "true" : "false"};
			var urlCache = new Map();
			var pendingRequests = new Map();

			if ('${fileId}' && !window.__MAGIC_FILE_ID__) {
				window.__MAGIC_FILE_ID__ = '${fileId}';
			}

			function isRelativePath(url) {
				if (!url) return false;
				return !/^(https?:\\/\\/|\\/\\/|data:|blob:|mailto:|tel:|javascript:|about:)/i.test(url);
			}

			function escapeRegExp(value) {
				return value.replace(/[-/\\\\^$*+?.()|[\\]{}]/g, "\\\\$&");
			}

			function shouldSkipUrl(url) {
				return !url || url.indexOf("__ORIGINAL_URL__") !== -1;
			}

			function generateRequestId() {
				return "dynamic_url_" + Date.now() + "_" + Math.random().toString(36).substr(2, 9);
			}

			function requestUrlFromParent(relativePath) {
				return new Promise(function(resolve, reject) {
					var requestId = generateRequestId();
					var timeout = setTimeout(function() {
						window.removeEventListener("message", messageHandler);
						pendingRequests.delete(relativePath);
						reject(new Error("URL resolve timeout"));
					}, 8000);

					function messageHandler(event) {
						if (
							event.data &&
							event.data.type === "MAGIC_FETCH_URL_RESPONSE" &&
							event.data.requestId === requestId
						) {
							clearTimeout(timeout);
							window.removeEventListener("message", messageHandler);

							if (event.data.success) {
								urlCache.set(relativePath, event.data.url);
								pendingRequests.delete(relativePath);
								resolve(event.data.url);
							} else {
								urlCache.set(relativePath, "__NOT_FOUND__");
								pendingRequests.delete(relativePath);
								reject(new Error(event.data.error || "URL resolve failed"));
							}
						}
					}

					window.addEventListener("message", messageHandler);

					(window.top || window.parent).postMessage(
						{
							type: "MAGIC_FETCH_URL_REQUEST",
							requestId: requestId,
							relativePath: relativePath,
							fileId: window.__MAGIC_FILE_ID__ || "",
						},
						"*",
					);
				});
			}

			function resolveUrl(relativePath) {
				if (urlCache.has(relativePath)) {
					var cached = urlCache.get(relativePath);
					if (cached === "__NOT_FOUND__") return Promise.resolve(null);
					return Promise.resolve(cached);
				}

				if (pendingRequests.has(relativePath)) {
					return pendingRequests.get(relativePath);
				}

				var requestPromise = requestUrlFromParent(relativePath)
					.then(function(url) {
						return url;
					})
					.catch(function() {
						return null;
					});

				pendingRequests.set(relativePath, requestPromise);

				return requestPromise;
			}

			function setOriginalPath(element, originalPath) {
				if (!element || !originalPath) return;
				element.setAttribute("data-original-path", originalPath);
			}

			function replaceAttributeUrl(element, attrName) {
				if (!isEnabled || !element || !element.getAttribute) return;

				var attrValue = element.getAttribute(attrName);
				if (!attrValue || shouldSkipUrl(attrValue)) return;
				if (!isRelativePath(attrValue)) return;

				resolveUrl(attrValue).then(function(resolvedUrl) {
					if (!resolvedUrl) return;
					setOriginalPath(element, attrValue);
					element.setAttribute(attrName, resolvedUrl);
				});
			}

			function replaceStyleText(styleText, applyResult) {
				if (!styleText || shouldSkipUrl(styleText)) return;

				var urlRegex = /url\\(\\s*(['"]?)([^'")]+)\\1\\s*\\)/gi;
				var match = null;
				var urlList = [];

				while ((match = urlRegex.exec(styleText)) !== null) {
					var rawUrl = match[2];
					if (isRelativePath(rawUrl)) {
						urlList.push(rawUrl);
					}
				}

				if (urlList.length === 0) return;

				var uniqueUrls = Array.from(new Set(urlList));

				Promise.all(
					uniqueUrls.map(function(url) {
						return resolveUrl(url).then(function(resolvedUrl) {
							return { original: url, resolved: resolvedUrl };
						});
					}),
				).then(function(results) {
					var nextStyle = styleText;

					results.forEach(function(result) {
						if (!result.resolved) return;
						var escaped = escapeRegExp(result.original);
						var replaceRegex = new RegExp(
							"url\\\\(\\\\s*['\\"]?" + escaped + "['\\"]?\\\\s*\\\\)",
							"g",
						);
						nextStyle = nextStyle.replace(
							replaceRegex,
							"/*__ORIGINAL_URL__:" + result.original + "__*/url('" + result.resolved + "')",
						);
					});

					applyResult(nextStyle);
				});
			}

			function replaceInlineStyle(element) {
				if (!element || !element.getAttribute) return;
				var styleText = element.getAttribute("style");
				replaceStyleText(styleText, function(nextStyle) {
					element.setAttribute("style", nextStyle);
				});
			}

			function replaceStyleTag(element) {
				if (!element) return;
				var styleText = element.textContent || "";
				replaceStyleText(styleText, function(nextStyle) {
					element.textContent = nextStyle;
				});
			}

		function processElement(element) {
			if (!element || element.nodeType !== 1) return;

			var tag = element.tagName;

			// 相对 HTML iframe 由 nested-iframe-content.ts 专门处理
			// 这里跳过，避免提前替换成 OSS URL 导致拦截失效
			if (tag === "IFRAME") {
				var iframeSrc = element.getAttribute("src");
				if (iframeSrc && !shouldSkipUrl(iframeSrc) && isRelativePath(iframeSrc)) {
					var cleanIframeSrc = iframeSrc.split(/[?#]/)[0];
					if (/[.]html?$/i.test(cleanIframeSrc)) {
						return;
					}
				}
			}

			if (
				tag === "IMG" ||
				tag === "IFRAME" ||
				tag === "SCRIPT" ||
				tag === "SOURCE" ||
				tag === "VIDEO" ||
				tag === "AUDIO" ||
				tag === "EMBED"
			) {
				replaceAttributeUrl(element, "src");
			}

				if (tag === "OBJECT") {
					replaceAttributeUrl(element, "data");
				}

				if (tag === "VIDEO") {
					replaceAttributeUrl(element, "poster");
				}

				if (tag === "LINK") {
					var rel = element.getAttribute("rel") || "";
					if (rel.toLowerCase() === "stylesheet") {
						replaceAttributeUrl(element, "href");
					}
				}

				if (element.hasAttribute && element.hasAttribute("style")) {
					replaceInlineStyle(element);
				}

				if (tag === "STYLE") {
					replaceStyleTag(element);
				}
			}

			function processNodeTree(node) {
				if (!node) return;

				if (node.nodeType === 1) {
					processElement(node);

					if (node.querySelectorAll) {
						node
							.querySelectorAll(
								"img,iframe,script,source,video,audio,embed,object,link[rel='stylesheet'],style,[style]",
							)
							.forEach(function(child) {
								processElement(child);
							});
					}
				}
			}

			function processExisting() {
				if (!isEnabled) return;
				processNodeTree(document.documentElement);
			}

			var observer = null;

			function setupObserver() {
				if (observer || !document.documentElement) return;

				observer = new MutationObserver(function(mutations) {
					if (!isEnabled) return;

					mutations.forEach(function(mutation) {
						if (mutation.type === "childList") {
							mutation.addedNodes.forEach(function(node) {
								processNodeTree(node);
							});
						}

						if (mutation.type === "attributes" && mutation.target) {
							var attrName = mutation.attributeName || "";
							if (
								attrName === "src" ||
								attrName === "href" ||
								attrName === "poster" ||
								attrName === "data" ||
								attrName === "style"
							) {
								processElement(mutation.target);
							}
						}
					});
				});

				observer.observe(document.documentElement, {
					childList: true,
					subtree: true,
					attributes: true,
					attributeFilter: ["src", "href", "poster", "data", "style"],
				});
			}

			function setEnabled(nextEnabled) {
				isEnabled = !!nextEnabled;

				if (isEnabled) {
					processExisting();
				}
			}

			window.__MAGIC_DYNAMIC_RESOURCE_INTERCEPTOR__ = {
				setEnabled: setEnabled,
				refresh: processExisting,
				isEnabled: function() {
					return isEnabled;
				},
			};

			if (document.readyState === "loading") {
				document.addEventListener("DOMContentLoaded", function() {
					processExisting();
					setupObserver();
				});
			} else {
				processExisting();
				setupObserver();
			}
		})();
	`
}

// 基础样式脚本
const getBaseStylesScript = () => {
	return `
		body {
			translate: no !important;
		}
	`
}

/**
 * 替换脚本内容中的全局 let/const 声明为 var，避免重复声明错误
 * 先检查是否是全局作用域（在计算括号之前），如果是全局作用域则进行替换，然后才计算当前行的括号
 * @param scriptContent - 脚本内容
 * @returns 替换后的脚本内容
 */
function replaceGlobalLetConst(scriptContent: string): string {
	const lines = scriptContent.split("\n")
	const result: string[] = []
	let braceCount = 0
	let parenCount = 0

	for (let i = 0; i < lines.length; i++) {
		let line = lines[i]

		// 先检查是否是全局作用域（在计算括号之前）
		const isGlobalScope = braceCount <= 0 && parenCount <= 0

		// 计算大括号和小括号
		braceCount += (line.match(/{/g) || []).length
		braceCount -= (line.match(/}/g) || []).length
		parenCount += (line.match(/\(/g) || []).length
		parenCount -= (line.match(/\)/g) || []).length

		// 如果括号计数变成负数，重置为0（避免负数累积）
		if (braceCount < 0) braceCount = 0
		if (parenCount < 0) parenCount = 0

		// 如果之前是全局作用域，进行替换
		if (isGlobalScope) {
			// 先匹配解构赋值：let { ... } = 或 const [ ... ] =
			line = line.replace(
				// eslint-disable-next-line no-useless-escape
				/(^|\s)(let|const)\s+(\{([^{}]|\{[^{}]*\})*\}|\[([^\[\]]|\[[^\[\]]*\])*\])\s*=/g,
				(_match, prefix, keyword, destructure) => {
					return `${prefix}/*__ORIGINAL_LET__:${keyword} ${destructure} =__*/var ${destructure} =`
				},
			)

			// 再匹配简单声明：let varName = 或 const varName =
			// 检查是否已经被替换过
			if (!line.includes("/*__ORIGINAL_LET__:")) {
				line = line.replace(
					/(^|\s)(let|const)\s+(\w+)\s*=/g,
					(_match, prefix, keyword, varName) => {
						return `${prefix}/*__ORIGINAL_LET__:${keyword} ${varName} =__*/var ${varName} =`
					},
				)
			}
		}

		result.push(line)
	}

	return result.join("\n")
}

//TAILWIND_CSS_URL和ECHARTS_JS_URL注入后不删除，其他资源注入后删除
export const getFullContent = (
	decodedContent: string,
	markerId?: string,
	options: GetFullContentOptions = {},
) => {
	const dynamicInterceptionOptions = options.dynamicInterception ?? {}

	// 使用DOMParser解析原始HTML
	const parser = new DOMParser()
	const doc = parser.parseFromString(decodedContent, "text/html")

	// 确保有html、head和body标签
	if (!doc.documentElement) {
		throw new Error("Invalid HTML: missing html element")
	}

	if (!doc.head) {
		const head = doc.createElement("head")
		doc.documentElement.insertBefore(head, doc.body)
	}

	if (!doc.body) {
		const body = doc.createElement("body")
		doc.documentElement.appendChild(body)
	}

	// 创建防翻译meta标签
	const metaNoTranslate = doc.createElement("meta")
	metaNoTranslate.setAttribute("name", "google")
	metaNoTranslate.setAttribute("content", "notranslate")
	metaNoTranslate.setAttribute("data-injected", "true")
	// 插入到head的最前面
	doc.head.insertBefore(metaNoTranslate, doc.head.firstChild)

	// 创建基础样式
	const styleElement = doc.createElement("style")
	styleElement.setAttribute("data-injected", "true")
	styleElement.textContent = getBaseStylesScript()
	doc.head.appendChild(styleElement)

	// 创建注入脚本
	const scriptElement = doc.createElement("script")
	scriptElement.setAttribute("data-injected", "true")
	scriptElement.textContent = `
		${getMagicMethodsScript()}
		${getCookieMockScript()}
		${getStorageMockScript(markerId)}
		${getIndexedDBMockScript()}
		${getServiceWorkerMockScript()}
		${getDOMContentLoadedScript()}
		${getLinkHandlingScript()}
		${getNestedIframeInterceptorScript()}
		${getDynamicResourceInterceptorScript(dynamicInterceptionOptions)}
	`
	doc.head.appendChild(scriptElement)

	// 在html标签上添加translate="no"属性
	doc.documentElement.setAttribute("translate", "no")

	// 处理 script 标签内的全局 let/const 声明，替换为 var 以避免重复声明错误
	const scriptElements = doc.querySelectorAll("script:not([src])")
	scriptElements.forEach((script) => {
		if (script.textContent) {
			script.textContent = replaceGlobalLetConst(script.textContent)
		}
	})

	// 注意：data-has-slide-bridge 标记已经在 htmlProcessor.ts 中添加
	// 这里不需要重复检测

	// 获取DOCTYPE
	const doctype = doc.doctype
	let doctypeString = ""
	if (doctype) {
		doctypeString = `<!DOCTYPE ${doctype.name}`
		if (doctype.publicId) {
			doctypeString += ` PUBLIC "${doctype.publicId}"`
		}
		if (doctype.systemId) {
			doctypeString += ` "${doctype.systemId}"`
		}
		doctypeString += ">\n"
	}

	// 返回完整的HTML（包含DOCTYPE）
	return doctypeString + doc.documentElement.outerHTML
}

const ESCAPED_HTML_DOCUMENT_PATTERN = /(?:&lt;|&#60;|&#x3c;)\s*(?:!doctype|html|head|body)\b/i

function shouldDecodeEscapedHtmlDocument(html: string): boolean {
	const trimmedHtml = html.trim()
	if (!trimmedHtml) return false

	return ESCAPED_HTML_DOCUMENT_PATTERN.test(trimmedHtml)
}

export function decodeHTMLEntities(html: string): string {
	if (!shouldDecodeEscapedHtmlDocument(html)) return html

	const textarea = document.createElement("textarea")
	textarea.innerHTML = html
	return textarea.value
}

interface DynamicResourceInterceptorOptions {
	enable?: boolean
	fileId?: string
}

interface GetFullContentOptions {
	dynamicInterception?: DynamicResourceInterceptorOptions
}
