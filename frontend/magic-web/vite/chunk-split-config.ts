import type { chunkSplitPlugin } from "vite-plugin-chunk-split"
/**
 * Vite Plugin Chunk Split Configuration
 * Optimized chunk splitting strategy using vite-plugin-chunk-split
 */

/**
 * Create chunk split configuration for vite-plugin-chunk-split
 * @returns Chunk split configuration object
 */
export function createChunkSplitConfig(): Parameters<typeof chunkSplitPlugin>[0] {
	return {
		strategy: "default",
		customSplitting: {
			// 🎨 Syntax Highlighting - Shiki
			// "vendor-shiki": [/node_modules\/shiki/],
			"vendor-shiki-langs-common": [
				/node_modules\/@shikijs\/langs\/(javascript|typescript|jsx|tsx|python|java|go|rust|c|cpp|csharp|html|css|scss|less|json|yaml|markdown|bash|shell|sql|php|ruby)\./,
			],

			// 🎨 Ant Design Icons（单独拆分，按需加载）
			"vendor-antd-icons": [
				/node_modules\/@ant-design\/icons/,
				/node_modules\/@ant-design\/icons-svg/,
			],

			// 🎨 Ant Design 样式系统（CSS-in-JS）
			// "vendor-antd-style": [/node_modules\/antd-style/, /node_modules\/@ant-design\/cssinjs/],

			// 🎨 Ant Design 其他工具
			"vendor-antd-utils": [/node_modules\/@ant-design\/(?!icons|cssinjs)/],

			// // 📝 Rich Text Editors - TipTap ecosystem
			// // Note: @radix-ui and @floating-ui are NOT included here to avoid React externalization issues
			// // They will be bundled with the components that use them
			// "vendor-editor-tiptap": [
			// 	/node_modules\/@tiptap/,
			// 	/node_modules\/prosemirror/,
			// 	/node_modules\/tiptap-markdown/,
			// ],

			// // 📊 Office & Document - Univer ecosystem
			// "vendor-office-univer": [
			// 	/node_modules\/@univerjs/,
			// 	/src\/opensource\/components\/UniverComponent/,
			// ],

			// 📊 Excel Processing - Separate chunk to avoid circular dependencies
			// "vendor-excel-libs": [/node_modules\/exceljs/, /node_modules\/xlsx-js-style/],

			// 📄 Document Processing - DOCX and PDF
			// "vendor-document": [/node_modules\/docx/, /node_modules\/docx-preview/],
			// "vendor-react-pdf": [/node_modules\/react-pdf/],
			// "vendor-jspdf": [/node_modules\/jspdf/],
			// "vendor-pdfjs-dist": [/node_modules\/pdfjs-dist/],

			// 🎯 Code Editor - Monaco
			"vendor-monaco-editor": [/node_modules\/monaco-editor(?!\/@monaco-editor\/react)/],
			"vendor-monaco-react": [/node_modules\/@monaco-editor\/react/],

			// 📊 Visualization - Charts and Diagrams
			// "vendor-mermaid": [/node_modules\/mermaid/],

			// 🎥 Media - Video and Audio players
			"vendor-media": [/node_modules\/(xgplayer|xterm)/],

			// 📅 Date & Time - DayJS (commonly used)
			"vendor-dayjs": [/node_modules\/dayjs/],

			// 🌐 Internationalization
			// "vendor-i18n": [
			// 	/node_modules\/(i18next|react-i18next)/,
			// 	/src\/assets\/locales\/(zh_CN|en_US)/,
			// 	/node_modules\/(antd|antd-mobile)\/.*\/locale\/(zh_CN|en_US)/,
			// 	/node_modules\/dayjs\/locale\/(zh-cn|en)/,
			// ],
			// "vendor-antd-asian-locales": [
			// 	/node_modules\/(antd|antd-mobile)\/.*\/locale\/(zh_TW|zh_HK|ja_JP|ko_KR|vi_VN|th_TH)/,
			// ],
			"vendor-datetime-locales": [/node_modules\/@fullcalendar\/.*\/locales\//],

			// 🎨 Animation & Motion
			// "vendor-animation": [/node_modules\/(framer-motion|motion|@lottiefiles)/],

			// 📝 Markdown & Syntax Highlighting
			"vendor-markdown": [/node_modules\/(react-markdown|remark-|rehype-|prismjs)/],

			// 🌐 Network & Data - SWR and WebSocket
			"vendor-network": [/node_modules\/(swr|socket\.io)/],

			// 💾 Storage - IndexedDB wrappers
			"vendor-storage": [/node_modules\/(dexie|idb-keyval)/],

			// 🔧 Utilities - Common utility libraries
			// "vendor-utils": [/node_modules\/(crypto-js|nanoid|uuid|radash)/],

			// Router - React Router
			"vendor-router": [/node_modules\/(react-router|history)/],

			// Form & Validation libraries
			"vendor-form-utils": [/node_modules\/(libphonenumber|validator)/],

			// Data Processing - JSON, YAML, XML
			// "vendor-data-processing": [/node_modules\/(js-yaml|@xmldom|jszip|pako)/],

			// File & Media utilities
			"vendor-file-utils": [/node_modules\/(file-type|audio-recorder-polyfill)/],

			// Upload SDK
			// "vendor-upload-sdk": [/node_modules\/(@dtyq\/upload-sdk|esdk-obs-browserjs)/],

			// Third-party integrations
			// "vendor-integrations": [/node_modules\/(@wecom|@amap|@arms|@apmplus)/],

			// UI Effects - Confetti, Polished, etc
			"vendor-ui-effects": [/node_modules\/(canvas-confetti|polished|tippy\.js)/],

			// Math & Text Processing
			// "vendor-text-processing": [/node_modules\/(katex|marked|diff)/],

			// // Virtual Lists & Performance
			// "vendor-virtualization": [
			// 	/node_modules\/(rc-virtual-list|react-virtuoso|react-infinite-scroll)/,
			// ],

			// // Resizable & Draggable
			// "vendor-layout-utils": [
			// 	/node_modules\/(re-resizable|react-resizable|react-draggable|react-resizable-panels)/,
			// ],

			// Presentation libraries
			// "vendor-presentation": [/node_modules\/(reveal\.js|@marp-team)/],

			// Slider and carousel
			"vendor-slider": [/node_modules\/swiper/],

			// Browser utilities
			"vendor-browser-utils": [/node_modules\/(ua-parser-js|rtl-detect)/],

			// Polyfills - Keep them small and separate
			"polyfills-core": [/src\/utils\/polyfill/],
		},
	}
}
