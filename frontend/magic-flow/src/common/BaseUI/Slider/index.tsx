import { Slider, SliderSingleProps } from "antd"
import clsx from "clsx"
import React from "react"
import styles from "./index.module.less"

export default function MagicSlider({ ...props }: SliderSingleProps) {
	return (
		<Slider {...props} className={clsx("nopan nodrag", styles.magicSlider, props.className)} />
	)
}
