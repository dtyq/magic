import { useMemoizedFn } from 'ahooks'
import React, { useState } from 'react'

export default function useExtraClassname() {

    const [extraClassname, setExtraClassname] = useState('')

    const makeCanScroll = useMemoizedFn(() => {
        setExtraClassname("nowheel")
    })

    const banScroll = useMemoizedFn(() => {
        setExtraClassname("")
    })

    return {
        makeCanScroll,banScroll,extraClassname
    }
}
