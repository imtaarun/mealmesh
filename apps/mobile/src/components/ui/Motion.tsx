import { useEffect, useRef, useState, type PropsWithChildren } from "react";
import { Text, type TextStyle, type ViewProps } from "react-native";
import Animated, { Easing, FadeInDown, LinearTransition, useReducedMotion } from "react-native-reanimated";

// Motion is reserved for moments with meaning (docs/ux.md "Motion"). Reanimated skips all
// of it when the system's Reduce Motion setting is on.

/** Content arriving: a short rise and fade, staggered by position. */
export function Appear({ index = 0, children, style }: PropsWithChildren<{ index?: number; style?: ViewProps["style"] }>) {
  return (
    <Animated.View entering={FadeInDown.duration(380).delay(Math.min(index, 8) * 60).easing(Easing.out(Easing.cubic))} style={style}>
      {children}
    </Animated.View>
  );
}

/** Rows that move when the list reorders (a ticked item sinking to the bottom). */
export const reorder = LinearTransition.springify().damping(20);

/** A money figure that counts to its value: up from zero at first, then from wherever it was. */
export function CountUp({ cents, format, style }: { cents: number; format: (cents: number) => string; style?: TextStyle }) {
  const reduce = useReducedMotion();
  const [shown, setShown] = useState(reduce ? cents : 0);
  const from = useRef(shown);
  from.current = shown;

  useEffect(() => {
    if (reduce) return setShown(cents);
    const start = from.current;
    const started = Date.now();
    let frame = requestAnimationFrame(function tick() {
      const t = Math.min(1, (Date.now() - started) / 700);
      setShown(Math.round(start + (cents - start) * (1 - Math.pow(1 - t, 3))));
      if (t < 1) frame = requestAnimationFrame(tick);
    });
    return () => cancelAnimationFrame(frame);
  }, [cents, reduce]);

  return <Text style={style}>{format(shown)}</Text>;
}
