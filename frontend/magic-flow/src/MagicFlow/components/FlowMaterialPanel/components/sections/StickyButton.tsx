import React, { memo } from "react"
import TSIcon from "@/common/BaseUI/TSIcon"
import clsx from "clsx"
import styles from "../../index.module.less"

interface StickyButtonProps {
  show: boolean
  setShow: (show: boolean) => void
  stickyButtonStyle: React.CSSProperties
}

const StickyButton = memo(({
  show,
  setShow,
  stickyButtonStyle
}: StickyButtonProps) => {
  return (
    <TSIcon
      type={show ? "ts-arrow-left" : "ts-arrow-right"}
      className={clsx(styles.stickyBtn, "stickyBtn")}
      onClick={() => setShow(!show)}
      style={stickyButtonStyle}
    />
  )
})

export default StickyButton 