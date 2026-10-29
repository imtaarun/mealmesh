import { Modal, Pressable, Text } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { PressableScale } from "@/components/ui/PressableScale";
import { useTheme } from "@/theme";

export interface SheetAction {
  label: string;
  onPress: () => void;
  destructive?: boolean;
}

interface ActionSheetProps {
  title?: string;
  actions: SheetAction[] | null;
  onClose: () => void;
}

/** Bottom sheet of actions: the one place secondary actions live, instead of buttons on every card. */
export function ActionSheet({ title, actions, onClose }: ActionSheetProps) {
  const { colors, spacing, radius, typography, minTouch } = useTheme();
  const { bottom } = useSafeAreaInsets();

  return (
    <Modal visible={actions !== null} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable accessibilityLabel="Close" onPress={onClose} style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "flex-end" }}>
        <Pressable
          style={{
            backgroundColor: colors.surface,
            borderTopLeftRadius: radius.xl,
            borderTopRightRadius: radius.xl,
            borderCurve: "continuous",
            padding: spacing.md,
            paddingBottom: spacing.md + bottom,
          }}
        >
          {title ? (
            <Text style={{ ...typography.caption, color: colors.textMuted, textAlign: "center", marginBottom: spacing.sm }} numberOfLines={1}>
              {title}
            </Text>
          ) : null}
          {actions?.map((action) => (
            <PressableScale
              key={action.label}
              onPress={() => {
                onClose();
                action.onPress();
              }}
              style={{ minHeight: minTouch + spacing.sm, justifyContent: "center", paddingHorizontal: spacing.md }}
            >
              <Text style={{ ...typography.bodyStrong, color: action.destructive ? colors.criticalError : colors.text }}>{action.label}</Text>
            </PressableScale>
          ))}
        </Pressable>
      </Pressable>
    </Modal>
  );
}
