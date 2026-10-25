import * as React from "react"
import { useTranslation } from "react-i18next"
import { Button } from "@/components/shadcn-ui/button"
import { cn } from "@/utils/cn"
import type { SimpleEditorProps, SimpleEditorRef } from "./types"

type SimpleEditorComponent = React.ComponentType<
	React.PropsWithoutRef<SimpleEditorProps> & React.RefAttributes<SimpleEditorRef>
>

type SimpleEditorModule = {
	SimpleEditor: SimpleEditorComponent
}

type LazySimpleEditorLoader = () => Promise<{ default: SimpleEditorComponent }>

const loadSimpleEditor: LazySimpleEditorLoader = () =>
	import("./simple-editor").then(({ SimpleEditor }: SimpleEditorModule) => ({
		default: SimpleEditor,
	}))

export function createLazySimpleEditor(loader: LazySimpleEditorLoader = loadSimpleEditor) {
	return React.lazy(loader)
}

interface LazySimpleEditorErrorBoundaryProps {
	children: React.ReactNode
	resetKey: number
	fallback: (retry: () => void) => React.ReactNode
	onRetry: () => void
}

interface LazySimpleEditorErrorBoundaryState {
	error: Error | null
}

class LazySimpleEditorErrorBoundary extends React.Component<
	LazySimpleEditorErrorBoundaryProps,
	LazySimpleEditorErrorBoundaryState
> {
	state: LazySimpleEditorErrorBoundaryState = { error: null }

	static getDerivedStateFromError(error: Error): LazySimpleEditorErrorBoundaryState {
		return { error }
	}

	componentDidUpdate(prevProps: LazySimpleEditorErrorBoundaryProps) {
		if (prevProps.resetKey !== this.props.resetKey && this.state.error) {
			this.setState({ error: null })
		}
	}

	render() {
		if (this.state.error) {
			return this.props.fallback(this.props.onRetry)
		}

		return this.props.children
	}
}

function LoadingFallback({ className }: Pick<SimpleEditorProps, "className">) {
	return (
		<div
			className={cn("min-h-24 w-full rounded-md bg-muted/20", className)}
			data-testid="simple-editor-loading"
			aria-busy="true"
		/>
	)
}

function ErrorFallback({
	className,
	content,
	onRetry,
}: Pick<SimpleEditorProps, "className" | "content"> & { onRetry: () => void }) {
	const { t } = useTranslation("component")

	return (
		<div
			className={cn(
				"flex min-h-24 w-full items-center justify-center gap-2 rounded-md bg-muted/20 p-3 text-sm text-muted-foreground",
				className,
			)}
			data-testid="simple-editor-error"
			role="alert"
		>
			<span>{t("bootstrap.initFailed")}</span>
			{typeof content === "string" ? (
				<pre
					className="max-h-40 min-w-0 max-w-full overflow-auto whitespace-pre-wrap rounded bg-background/60 p-2 text-left text-xs"
					data-testid="simple-editor-preserved-content"
				>
					{content}
				</pre>
			) : null}
			<Button
				type="button"
				variant="outline"
				size="sm"
				onClick={onRetry}
				data-testid="simple-editor-retry"
			>
				{t("bootstrap.retry")}
			</Button>
		</div>
	)
}

export interface LazySimpleEditorProps extends SimpleEditorProps {
	/** Called once the dynamically loaded editor has created its imperative handle. */
	onReady?: (handle: SimpleEditorRef) => void
}

export const LazySimpleEditor = React.forwardRef<SimpleEditorRef, LazySimpleEditorProps>(
	function LazySimpleEditor({ onReady, className, ...props }, forwardedRef) {
		const [retryKey, setRetryKey] = React.useState(0)
		const [LazyEditor, setLazyEditor] = React.useState(() => createLazySimpleEditor())

		const onReadyRef = React.useRef(onReady)
		const readyEditorRef = React.useRef<SimpleEditorRef["editor"]>(null)
		onReadyRef.current = onReady

		const assignEditorRef = React.useCallback(
			(handle: SimpleEditorRef | null) => {
				const currentForwardedRef = forwardedRef
				if (typeof currentForwardedRef === "function") {
					currentForwardedRef(handle)
				} else if (currentForwardedRef) {
					;(
						currentForwardedRef as React.MutableRefObject<SimpleEditorRef | null>
					).current = handle
				}

				// TipTap uses immediatelyRender:false: the first handle still has editor:null.
				// Consumers may insert content in onReady, so notify only after editor creation.
				if (handle?.editor && readyEditorRef.current !== handle.editor) {
					readyEditorRef.current = handle.editor
					onReadyRef.current?.(handle)
				}
			},
			[forwardedRef],
		)

		const retry = React.useCallback(() => {
			setRetryKey((value) => value + 1)
			setLazyEditor(() => createLazySimpleEditor())
		}, [])

		return (
			<LazySimpleEditorErrorBoundary
				resetKey={retryKey}
				onRetry={retry}
				fallback={(handleRetry) => (
					<ErrorFallback
						className={className}
						content={props.content}
						onRetry={handleRetry}
					/>
				)}
			>
				<React.Suspense fallback={<LoadingFallback className={className} />}>
					<LazyEditor {...props} className={className} ref={assignEditorRef} />
				</React.Suspense>
			</LazySimpleEditorErrorBoundary>
		)
	},
)
