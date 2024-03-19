import MagicLogo from "@/opensource/components/MagicLogo"
import { createStyles, cx } from "antd-style"
import type { HTMLAttributes } from "react"
import { useRef } from "react"
import { useTranslation } from "react-i18next"
import { useFloating, arrow, FloatingArrow, useMergeRefs } from "@floating-ui/react"

const useStyles = createStyles(({ css }) => {
	return {
		container: {
			position: "relative",
			pointerEvents: "none",
			userSelect: "none",
		},
		tooltip: css`
			border-radius: 4.8px;
			padding: 6.4px 9.6px;
			color: white;
			font-size: 11.2px;
			font-weight: 400;
			line-height: 16px;
			background-color: var(--background-color);
		`,
		tooltip1: {
			animationDelay: "1s",
			"--background-color": "#41464C",
			left: "-100px !important",
			maxWidth: 190,
		},
		tooltip2: {
			animationDelay: "6s",
			"--background-color": "#315CEC",
			top: "130px !important",
			left: "-160px !important",
			maxWidth: 148,
		},
		tooltip3: {
			animationDelay: "10s",
			top: "50px !important",
			left: "260px !important",
			"--background-color": "#943200",
			width: 170,
			maxWidth: 170,
		},
		tooltip4: {
			animationDelay: "4s",
			top: "150px !important",
			left: "340px !important",
			"--background-color": "#009EAF",
			width: 170,
		},

		logo: {
			width: 323,
		},
	}
})

function HomeBotAnimation({ ...props }: HTMLAttributes<HTMLDivElement>) {
	const { t } = useTranslation("interface")

	const { styles } = useStyles()
	const containerRef = useRef<HTMLDivElement>(null)

	const arrowRef1 = useRef(null)
	const arrowRef2 = useRef(null)
	const arrowRef3 = useRef(null)
	const arrowRef4 = useRef(null)
	const {
		refs: refs1,
		floatingStyles: floatingStyles1,
		context: context1,
	} = useFloating({
		placement: "top-start",
		middleware: [
			arrow({
				element: arrowRef1,
			}),
		],
	})

	const {
		refs: refs2,
		floatingStyles: floatingStyles2,
		context: context2,
	} = useFloating({
		placement: "left",
		middleware: [
			arrow({
				element: arrowRef2,
			}),
		],
	})

	const {
		refs: refs3,
		floatingStyles: floatingStyles3,
		context: context3,
	} = useFloating({
		placement: "top-end",
		middleware: [
			arrow({
				element: arrowRef3,
			}),
		],
	})

	const {
		refs: refs4,
		floatingStyles: floatingStyles4,
		context: context4,
	} = useFloating({
		placement: "right",
		middleware: [
			arrow({
				element: arrowRef4,
			}),
		],
	})

	const ref = useMergeRefs([
		refs1.setReference,
		refs2.setReference,
		refs3.setReference,
		refs4.setReference,
	])

	return (
		<div {...props}>
			<div ref={containerRef} className={styles.container}>
				<span
					ref={refs1.setFloating}
					style={floatingStyles1}
					className={cx(styles.tooltip1, styles.tooltip, "heart")}
				>
					<FloatingArrow
						ref={arrowRef1}
						context={context1}
						fill="currentColor"
						style={{ color: "var(--background-color)", transform: "translateY(-1px)" }}
					/>
					{t("home.botAnimation.tooltip1")}
				</span>
				<span
					ref={refs2.setFloating}
					style={floatingStyles2}
					className={cx(styles.tooltip2, styles.tooltip, "heart")}
				>
					<FloatingArrow
						ref={arrowRef2}
						context={context2}
						fill="currentColor"
						style={{ color: "var(--background-color)", transform: "translateY(-1px)" }}
					/>
					{t("home.botAnimation.tooltip2")}
				</span>
				<span
					ref={refs3.setFloating}
					style={floatingStyles3}
					className={cx(styles.tooltip3, styles.tooltip, "heart")}
				>
					<FloatingArrow
						ref={arrowRef3}
						context={context3}
						fill="currentColor"
						style={{
							color: "var(--background-color)",
							transform: "translate(16px,-1px)",
						}}
					/>
					{t("home.botAnimation.tooltip3")}
				</span>
				<span
					ref={refs4.setFloating}
					style={floatingStyles4}
					className={cx(styles.tooltip4, styles.tooltip, "heart")}
				>
					<FloatingArrow
						ref={arrowRef4}
						context={context4}
						fill="currentColor"
						style={{ color: "var(--background-color)", transform: "translateY(-1px)" }}
					/>
					{t("home.botAnimation.tooltip4")}
				</span>
				<div ref={ref}>
					<MagicLogo className={styles.logo} />
				</div>
			</div>
		</div>
	)
}

export default HomeBotAnimation
