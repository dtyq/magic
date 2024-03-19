import { IconChevronLeft } from "@tabler/icons-react"
import React, { memo } from "react"
import { useMemoizedFn } from "ahooks"
import styles from "../../index.module.less"

interface BackButtonProps {
  backIcon: React.ReactNode
}

const BackButton = memo(({ backIcon }: BackButtonProps) => {
  const navigateBack = useMemoizedFn(() => {
    window.history.back()
  })

  return (
    <>
      {backIcon}
      {!backIcon && (
        <IconChevronLeft
          stroke={2}
          className={styles.backIcon}
          onClick={navigateBack}
        />
      )}
    </>
  )
})

export default BackButton 