import { Button } from "antd"
import { IconCopyPlus } from "@tabler/icons-react"
import clsx from "clsx"
import React, { memo } from "react"
import { prefix } from "@/MagicFlow/constants"
import styles from "../../index.module.less"

interface HeaderRightProps {
  header: any
  isSaveBtnLoading: boolean
  isPublishBtnLoading: boolean
}

const HeaderRight = memo(({
  header,
  isSaveBtnLoading,
  isPublishBtnLoading
}: HeaderRightProps) => {
  return (
    <div className={clsx(styles.right, `${prefix}right`)}>
      {header?.buttons}
      {!header?.buttons && (
        <>
          <Button
            type="default"
            className={clsx(styles.btn, `${prefix}btn`)}
            loading={isSaveBtnLoading}
          >
            试运行
          </Button>
          <Button
            type="primary"
            className={clsx(styles.btn, `${prefix}btn`)}
            loading={isPublishBtnLoading}
          >
            发布
          </Button>
          <Button
            type="default"
            className={clsx(styles.copyBtn, `${prefix}copy-btn`)}
            loading={isSaveBtnLoading}
          >
            <IconCopyPlus color="#77777b" />
          </Button>
        </>
      )}
    </div>
  )
})

export default HeaderRight 