import { useCallback, useRef } from 'react';

export default function useInput() {
  const isEntering = useRef(false);

  const handleEnterChinese = useCallback((evt: any, newValue: string) => {
    const { data } = evt.nativeEvent
    console.log(evt, data);
    // 中文输入法开始输入
    if (evt.type === 'compositionstart') {
      isEntering.current = true;
      return -1;
    }

    // 中文输入法结束输入
    if (evt.type === 'compositionend') {
      isEntering.current = false;
    }

    // 中间输入拼音的时候如果还没结束输入那么后面就不用执行
    if (isEntering.current) return -1;

    return newValue;
  }, []);
  return {
    handleEnterChinese,
  };
}
