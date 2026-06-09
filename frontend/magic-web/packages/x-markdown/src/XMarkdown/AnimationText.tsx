import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AnimationConfig } from './interface';

export interface AnimationTextProps {
  text: string;
  animationConfig?: AnimationConfig;
}

const AnimationText = React.memo<AnimationTextProps>((props) => {
  const { text, animationConfig } = props;
  const { fadeDuration = 200, easing = 'ease-in-out' } = animationConfig || {};
  const [chunks, setChunks] = useState<string[]>([]);
  const prevTextRef = useRef('');

  useEffect(() => {
    if (text === prevTextRef.current) return;

    if (!(prevTextRef.current && text.indexOf(prevTextRef.current) === 0)) {
      setChunks([text]);
      prevTextRef.current = text;
      return;
    }

    const newText = text.slice(prevTextRef.current.length);
    if (!newText) return;

    setChunks((prev) => [...prev, newText]);
    prevTextRef.current = text;
  }, [text]);

  const animationStyle = useMemo(
    () => ({
      animation: `x-markdown-fade-in ${fadeDuration}ms ${easing} forwards`,
      color: 'inherit',
    }),
    [fadeDuration, easing],
  );

  return (
    <>
      {chunks.map((text, index) => (
        <span style={animationStyle} key={`animation-text-${index}`}>
          {text}
        </span>
      ))}
    </>
  );
});

export default AnimationText;
