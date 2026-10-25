import type { CanvasDesignPlugin } from "../../../../../runtime/document/types"
import type { CanvasAccessMode } from "../../../../../public/props"

export function createPluginSrcDocV1(
	plugin: CanvasDesignPlugin,
	locale: string,
	channelToken: string,
	hostState: { accessMode: CanvasAccessMode },
) {
	const runtimeCode = plugin.runtimeCode
	const runtimeUrl = plugin.runtimeUrl
	if (!runtimeCode && !runtimeUrl) return null

	const bootstrap = {
		channelToken,
		locale,
		locales: plugin.locales ?? {},
		host: {
			locale,
			accessMode: hostState.accessMode,
		},
	}
	const runtimeScript = runtimeCode
		? `<script>${escapeInlineScript(runtimeCode)}</script>`
		: `<script src="${runtimeUrl}"></script>`
	const styleTags = (plugin.styleCode ?? [])
		.map((styleCode) => `<style>${escapeInlineStyle(styleCode)}</style>`)
		.join("\n")

	return `<!doctype html>
<html>
<head>
	<meta charset="utf-8" />
	<meta name="viewport" content="width=device-width, initial-scale=1" />
	<style>
		html, body, #root {
			margin: 0;
			min-height: 100%;
			font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
			color: #0a0a0a;
			background: #fff;
		}
		* { box-sizing: border-box; }
	</style>
	${styleTags}
</head>
<body>
	<div id="root"></div>
	<script>
		const __MAGIC_CANVAS_BOOTSTRAP__ = ${JSON.stringify(bootstrap)};
		let __MAGIC_CANVAS_PLUGIN__ = null;
		let __MAGIC_CANVAS_INSTANCE__ = null;
		let __MAGIC_CANVAS_VIEW__ = null;
		let __MAGIC_CANVAS_SCOPE__ = null;
		let __MAGIC_CANVAS_DISPOSED__ = false;
		let __MAGIC_CANVAS_LAST_POINTER__ = null;
		let __MAGIC_CANVAS_ACTIVE_DRAG_SESSION_ID__ = null;
		const __MAGIC_CANVAS_STATE_BINDINGS__ = new WeakMap();

		window.registerMagicCanvasPlugin = function registerMagicCanvasPlugin(plugin) {
			__MAGIC_CANVAS_PLUGIN__ = plugin;
		};

		function postHost(message, transfer) {
			window.parent.postMessage(
				{
					channelToken: __MAGIC_CANVAS_BOOTSTRAP__.channelToken,
					...message,
				},
				"*",
				transfer || []
			);
		}

		function t(key, fallback) {
			const locale = __MAGIC_CANVAS_BOOTSTRAP__.locale;
			const locales = __MAGIC_CANVAS_BOOTSTRAP__.locales || {};
			return (
				locales[locale]?.[key] ??
				locales[locale?.split("-")[0]]?.[key] ??
				locales["zh-CN"]?.[key] ??
				locales["en-US"]?.[key] ??
				fallback ??
				key
			);
		}

		function createRequestId() {
			return Math.random().toString(36).slice(2);
		}

		function requestHost(message, resultType) {
			return new Promise((resolve, reject) => {
				const requestId = createRequestId();
				function handleHostResult(event) {
					// 只接受来自宿主窗口的回包，避免同页其他 frame 伪造 request 结果。
					if (event.source !== window.parent) return;
					const data = event.data;
					if (
						!data ||
						data.channelToken !== __MAGIC_CANVAS_BOOTSTRAP__.channelToken ||
						data.type !== resultType ||
						data.requestId !== requestId
					) {
						return;
					}
					window.removeEventListener("message", handleHostResult);
					if (data.error) {
						reject(new Error(data.error));
						return;
					}
					resolve(data);
				}
				window.addEventListener("message", handleHostResult);
				const transfer = message.transfer;
				const payload = { ...message };
				delete payload.transfer;
				postHost({ ...payload, requestId }, transfer);
			});
		}

		function cloneState(state) {
			return state && typeof state === "object" ? { ...state } : state;
		}

		function assertStateObject(state) {
			if (!state || typeof state !== "object") {
				throw new Error("ctx.state expects a state object created by ctx.state.create.");
			}
		}

		function ensureStateBinding(state) {
			assertStateObject(state);
			let binding = __MAGIC_CANVAS_STATE_BINDINGS__.get(state);
			if (!binding) {
				binding = {
					view: null,
					prevState: null,
					nextState: null,
					keys: new Set(),
					scheduled: false,
				};
				__MAGIC_CANVAS_STATE_BINDINGS__.set(state, binding);
			}
			return binding;
		}

		function bindStateToView(state, view) {
			if (!state || typeof state !== "object") return;
			ensureStateBinding(state).view = view || null;
		}

		function unbindState(state) {
			if (!state || typeof state !== "object") return;
			const binding = __MAGIC_CANVAS_STATE_BINDINGS__.get(state);
			if (binding) binding.view = null;
		}

		function scheduleStateUpdate(state, binding, prevState, keys, options) {
			if (options?.silent || !keys.length || !binding.view?.update) return;
			if (!binding.prevState) binding.prevState = prevState;
			binding.nextState = cloneState(state);
			keys.forEach((key) => binding.keys.add(key));
			if (binding.scheduled) return;
			binding.scheduled = true;
			queueMicrotask(() => {
				binding.scheduled = false;
				const change = {
					prevState: binding.prevState,
					nextState: binding.nextState,
					keys: new Set(binding.keys),
				};
				binding.prevState = null;
				binding.nextState = null;
				binding.keys.clear();
				binding.view?.update?.(change);
			});
		}

		function patchState(state, patch, options) {
			assertStateObject(state);
			const normalizedPatch = patch && typeof patch === "object" ? patch : {};
			const binding = ensureStateBinding(state);
			const prevState = cloneState(state);
			const changedKeys = [];
			Object.keys(normalizedPatch).forEach((key) => {
				if (state[key] !== normalizedPatch[key]) {
					state[key] = normalizedPatch[key];
					changedKeys.push(key);
				}
			});
			scheduleStateUpdate(state, binding, prevState, changedKeys, options);
			return state;
		}

		function replaceState(state, nextState, options) {
			assertStateObject(state);
			const normalizedNextState = nextState && typeof nextState === "object" ? nextState : {};
			const binding = ensureStateBinding(state);
			const prevState = cloneState(state);
			const keys = new Set([...Object.keys(state), ...Object.keys(normalizedNextState)]);
			const changedKeys = [];
			keys.forEach((key) => {
				if (state[key] !== normalizedNextState[key]) changedKeys.push(key);
			});
			Object.keys(state).forEach((key) => {
				if (!(key in normalizedNextState)) delete state[key];
			});
			Object.assign(state, normalizedNextState);
			scheduleStateUpdate(state, binding, prevState, changedKeys, options);
			return state;
		}

		function normalizeView(view) {
			if (typeof view === "function") {
				return { dispose: view };
			}
			if (view && typeof view === "object") {
				return view;
			}
			return {};
		}

		function createLifecycleScope(reason) {
			const controller = new AbortController();
			const scope = {
				signal: controller.signal,
				reason,
				abort(nextReason) {
					scope.reason = nextReason || scope.reason;
					if (!controller.signal.aborted) controller.abort(scope.reason);
				},
				throwIfAborted() {
					if (controller.signal.aborted) {
						throw new Error("Plugin lifecycle aborted.");
					}
				},
			};
			return scope;
		}

		const ctx = {
			plugin: ${JSON.stringify({
				name: plugin.name,
				version: plugin.version,
				icon: plugin.icon,
				tags: plugin.tags,
				source: plugin.source,
				capabilities: plugin.capabilities,
			})},
			host: __MAGIC_CANVAS_BOOTSTRAP__.host,
			i18n: {
				locale: __MAGIC_CANVAS_BOOTSTRAP__.locale,
				t,
			},
			ui: {
				toast(message, type) {
					postHost({ type: "magic-canvas-plugin:toast", message, toastType: type });
				},
				close() {
					postHost({ type: "magic-canvas-plugin:close" });
				},
				setHeight(height) {
					postHost({ type: "magic-canvas-plugin:set-height", height });
				},
			},
			state: {
				create(initialState = {}) {
					const state = { ...initialState };
					ensureStateBinding(state);
					return state;
				},
				patch: patchState,
				replace: replaceState,
			},
			panel: {
				render(root, config) {
					if (!window.MagicPluginKit?.render) {
						throw new Error("MagicPluginKit.render is not available.");
					}
					return window.MagicPluginKit.render(ctx, root, config);
				},
			},
			resources: {
				resolve(path) {
					return requestHost(
						{ type: "magic-canvas-plugin:resolve-resource", path },
						"magic-canvas-plugin:resolve-resource-result"
					).then((data) => data.url);
				},
			},
			assets: {
				pickFiles(options = {}) {
					const normalizedOptions = options || {};
					const triggerPoint =
						__MAGIC_CANVAS_LAST_POINTER__ &&
						Date.now() - __MAGIC_CANVAS_LAST_POINTER__.timestamp < 2000
							? {
									x: __MAGIC_CANVAS_LAST_POINTER__.x,
									y: __MAGIC_CANVAS_LAST_POINTER__.y,
								}
							: undefined;
					__MAGIC_CANVAS_LAST_POINTER__ = null;
					return requestHost(
						{ type: "magic-canvas-plugin:pick-files", options: normalizedOptions, triggerPoint },
						"magic-canvas-plugin:pick-files-result"
					).then((data) => data.files || []);
				},
				uploadFile(file, fileName, mimeType) {
					return file.arrayBuffer().then((arrayBuffer) => {
						return requestHost(
							{
								type: "magic-canvas-plugin:upload-file",
								arrayBuffer,
								fileName: fileName || "mask.png",
								mimeType: mimeType || "image/png",
								transfer: [arrayBuffer],
							},
							"magic-canvas-plugin:upload-file-result"
						).then((data) => data.file);
					});
				},
				resolveFileAssets(files, options = {}) {
					return requestHost(
						{
							type: "magic-canvas-plugin:resolve-file-assets",
							files: Array.isArray(files) ? files : [],
							options,
						},
						"magic-canvas-plugin:resolve-file-assets-result"
					).then((data) => data.files || []);
				},
				readCanvasClipboard() {
					return requestHost(
						{ type: "magic-canvas-plugin:read-canvas-clipboard" },
						"magic-canvas-plugin:read-canvas-clipboard-result"
					).then((data) => ({
						payload: data.payload ?? null,
						uploadedAssets: data.uploadedAssets || [],
					}));
				},
				fetchBlob(url) {
					return requestHost(
						{ type: "magic-canvas-plugin:fetch-blob", url },
						"magic-canvas-plugin:fetch-blob-result"
					).then((data) => new Blob([data.arrayBuffer]));
				},
				// 插件内部命中/离开投放区时调用，宿主据此决定鼠标释放后是否 drop。
				reportCanvasAssetDragTarget(target = {}) {
					const dragSessionId = __MAGIC_CANVAS_ACTIVE_DRAG_SESSION_ID__;
					if (!dragSessionId) return;
					postHost({
						type: "magic-canvas-plugin:canvas-asset-drag-target",
						dragSessionId,
						targetId: typeof target.targetId === "string" ? target.targetId : null,
						mode: target.mode,
						canDrop: target.canDrop === true,
						importRemaining: target.importRemaining,
					});
				},
			},
			storage: (() => {
				const privateStorage = {
					getItem(key) {
						return requestHost(
							{ type: "magic-canvas-plugin:storage-get", key: String(key) },
							"magic-canvas-plugin:storage-get-result"
						).then((data) => data.value ?? null);
					},
					setItem(key, value) {
						return requestHost(
							{
								type: "magic-canvas-plugin:storage-set",
								key: String(key),
								value: String(value ?? ""),
							},
							"magic-canvas-plugin:storage-set-result"
						).then(() => undefined);
					},
					removeItem(key) {
						return requestHost(
							{ type: "magic-canvas-plugin:storage-remove", key: String(key) },
							"magic-canvas-plugin:storage-remove-result"
						).then(() => undefined);
					},
				};

				const sharedStorage = {
					getGenerationConfig() {
						return requestHost(
							{ type: "magic-canvas-plugin:storage-get-shared-generation-config" },
							"magic-canvas-plugin:storage-get-shared-generation-config-result"
						).then((data) => data.value ?? null);
					},
					setGenerationConfig(value) {
						return requestHost(
							{
								type: "magic-canvas-plugin:storage-set-shared-generation-config",
								value: String(value ?? ""),
							},
							"magic-canvas-plugin:storage-set-shared-generation-config-result"
						).then(() => undefined);
					},
					clearGenerationConfig() {
						return requestHost(
							{ type: "magic-canvas-plugin:storage-remove-shared-generation-config" },
							"magic-canvas-plugin:storage-remove-shared-generation-config-result"
						).then(() => undefined);
					},
				};

				return {
					getItem: privateStorage.getItem,
					setItem: privateStorage.setItem,
					removeItem: privateStorage.removeItem,
					private: privateStorage,
					shared: sharedStorage,
				};
			})(),
			ai: {
				getImageModels() {
					return requestHost(
						{ type: "magic-canvas-plugin:get-image-models" },
						"magic-canvas-plugin:get-image-models-result"
					).then((data) => data.models || []);
				},
				generateAndPlace(params) {
					return requestHost(
						{ type: "magic-canvas-plugin:generate-and-place", params },
						"magic-canvas-plugin:generate-and-place-result"
					).then((data) => data.result);
				},
				completeImagePrompt(params) {
					return requestHost(
						{ type: "magic-canvas-plugin:complete-image-prompt", params },
						"magic-canvas-plugin:complete-image-prompt-result"
					).then((data) => data.result);
				},
			},
		};

		window.addEventListener("error", (event) => {
			postHost({
				type: "magic-canvas-plugin:error",
				message: event.message,
			});
		});

		window.addEventListener("unhandledrejection", (event) => {
			postHost({
				type: "magic-canvas-plugin:error",
				message: event.reason instanceof Error ? event.reason.message : String(event.reason ?? ""),
			});
		});

		document.addEventListener("pointerdown", (event) => {
			__MAGIC_CANVAS_LAST_POINTER__ = {
				x: event.clientX,
				y: event.clientY,
				timestamp: Date.now(),
			};
			postHost({ type: "magic-canvas-plugin:pointer-down" });
		}, true);

		// 宿主只把画布图片拖拽相关消息转成 iframe 内的 CustomEvent，插件代码无需监听 postMessage。
		window.addEventListener("message", (event) => {
			// 只接受宿主下发的拖拽消息，避免同页其他 frame 伪造 move/leave/drop。
			if (event.source !== window.parent) return;
			const data = event.data;
			if (!data || data.channelToken !== __MAGIC_CANVAS_BOOTSTRAP__.channelToken) return;
			if (
				data.type !== "magic-canvas-plugin:canvas-asset-drag-move" &&
				data.type !== "magic-canvas-plugin:canvas-asset-drag-leave" &&
				data.type !== "magic-canvas-plugin:canvas-asset-drop"
			) {
				return;
			}
			if (data.type === "magic-canvas-plugin:canvas-asset-drag-move") {
				const dragSessionId =
					typeof data.dragSessionId === "string" ? data.dragSessionId.trim() : "";
				__MAGIC_CANVAS_ACTIVE_DRAG_SESSION_ID__ = dragSessionId || null;
			} else if (data.type === "magic-canvas-plugin:canvas-asset-drag-leave") {
				__MAGIC_CANVAS_ACTIVE_DRAG_SESSION_ID__ = null;
			}
			window.dispatchEvent(new CustomEvent(data.type, { detail: data }));
		});
	</script>
	${runtimeScript}
	<script>
		async function cleanupPlugin(reason) {
			if (__MAGIC_CANVAS_DISPOSED__) return;
			__MAGIC_CANVAS_DISPOSED__ = true;
			const scope = __MAGIC_CANVAS_SCOPE__;
			const instance = __MAGIC_CANVAS_INSTANCE__;
			const view = __MAGIC_CANVAS_VIEW__;
			const plugin = __MAGIC_CANVAS_PLUGIN__;
			scope?.abort?.(reason);
			unbindState(instance?.state);
			await view?.deactivate?.(scope);
			await view?.dispose?.(reason);
			await plugin?.dispose?.(ctx, instance, reason);
		}

		Promise.resolve().then(async function mountPlugin() {
			const root = document.getElementById("root");
			const plugin = __MAGIC_CANVAS_PLUGIN__;
			if (!plugin) {
				throw new Error("Plugin did not call registerMagicCanvasPlugin.");
			}
			__MAGIC_CANVAS_SCOPE__ = createLifecycleScope("open");
			if (typeof plugin.create === "function" || typeof plugin.render === "function") {
				if (typeof plugin.create !== "function" || typeof plugin.render !== "function") {
					throw new Error("Plugin did not call registerMagicCanvasPlugin({ create, render }).");
				}
				__MAGIC_CANVAS_INSTANCE__ = plugin.create(ctx);
				await plugin.prepare?.(ctx, __MAGIC_CANVAS_INSTANCE__, __MAGIC_CANVAS_SCOPE__);
				__MAGIC_CANVAS_SCOPE__.throwIfAborted();
				__MAGIC_CANVAS_VIEW__ = normalizeView(
					await plugin.render(ctx, __MAGIC_CANVAS_INSTANCE__, root, __MAGIC_CANVAS_SCOPE__)
				);
				bindStateToView(__MAGIC_CANVAS_INSTANCE__?.state, __MAGIC_CANVAS_VIEW__);
				await __MAGIC_CANVAS_VIEW__?.activate?.(__MAGIC_CANVAS_SCOPE__);
				return;
			}
			if (typeof plugin.mount === "function") {
				__MAGIC_CANVAS_VIEW__ = normalizeView(plugin.mount(ctx, root));
				return;
			}
			throw new Error("Plugin did not call registerMagicCanvasPlugin({ create, render }) or registerMagicCanvasPlugin({ mount }).");
		}).catch((error) => {
			postHost({
				type: "magic-canvas-plugin:error",
				message: error instanceof Error ? error.message : String(error ?? ""),
			});
			void cleanupPlugin("runtime-error");
		});
		window.addEventListener("pagehide", function handlePageHide() {
			void cleanupPlugin("close");
		});
	</script>
</body>
</html>`
}

function escapeInlineScript(code: string) {
	return code.replace(/<\/script/gi, "<\\/script")
}

function escapeInlineStyle(code: string) {
	return code.replace(/<\/style/gi, "<\\/style")
}
