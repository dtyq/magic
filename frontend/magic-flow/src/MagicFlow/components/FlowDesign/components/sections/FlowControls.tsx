import React, { memo } from "react"
import { Controls } from "reactflow"
import { Tooltip } from "antd"
import clsx from "clsx"
import { prefix } from "@/MagicFlow/constants"
import styles from "../../index.module.less"

interface FlowControlsProps {
  controlItemGroups: any[][]
}

const FlowControls = memo(({ controlItemGroups }: FlowControlsProps) => {
  return (
    <Controls
      showFitView={false}
      showInteractive={false}
      showZoom={false}
      className={clsx(styles.controls, `${prefix}controls`)}
      position="bottom-right"
    >
      {controlItemGroups.map((controlItems, i) => {
        return (
          <div className={styles.groupWrap} key={`group-${i}`}>
            {controlItems.map((c, index) => {
              return (
                <Tooltip
                  title={c.tooltips}
                  // @ts-ignore
                  onClick={c.callback}
                  key={`control-${c.tooltips}-${index}`}
                >
                  <span
                    className={clsx(
                      styles.controlItem,
                      `${prefix}control-item`,
                      {
                        // @ts-ignore
                        [styles.lockItem]: c.isLock,
                        // @ts-ignore
                        [styles.isNotIcon]: c.isNotIcon,
                        // @ts-ignore
                        [styles.showMinMap]: c.showMinMap,
                      },
                    )}
                  >
                    {c.icon}
                  </span>
                </Tooltip>
              )
            })}

            <svg className={clsx(styles.line, `${prefix}line`)}>
              <line
                x1={-10}
                y1={0}
                x2={-10}
                y2={20}
                stroke="#1C1D2314"
                strokeWidth="1"
              />
            </svg>
          </div>
        )
      })}
    </Controls>
  )
})

export default FlowControls 