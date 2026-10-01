import { useRef, type ReactNode } from "react";
import { Animated, Pressable, type PressableProps, type StyleProp, type ViewStyle } from "react-native";
import { useReducedMotion } from "react-native-reanimated";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

type Props = Omit<PressableProps, "style" | "children"> & { style?: StyleProp<ViewStyle>; children?: ReactNode };

/** Slight scale and fade while pressed; still when Reduce Motion is on. */
export function PressableScale({ style, onPressIn, onPressOut, ...props }: Props) {
  const reduceMotion = useReducedMotion();
  const pressed = useRef(new Animated.Value(0)).current;
  const animate = (toValue: number) =>
    !reduceMotion && Animated.spring(pressed, { toValue, useNativeDriver: true, speed: 40, bounciness: 0 }).start();

  return (
    <AnimatedPressable
      accessibilityRole="button"
      {...props}
      onPressIn={(e) => (animate(1), onPressIn?.(e))}
      onPressOut={(e) => (animate(0), onPressOut?.(e))}
      style={[
        style,
        {
          opacity: pressed.interpolate({ inputRange: [0, 1], outputRange: [1, 0.85] }),
          transform: [{ scale: pressed.interpolate({ inputRange: [0, 1], outputRange: [1, 0.97] }) }],
        },
      ]}
    />
  );
}
