import { Modal, Pressable, ScrollView, Text, useWindowDimensions, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { PressableScale } from "@/components/ui/PressableScale";
import { useTheme } from "@/theme";

export interface SheetAction {
  label: string;
  onPress: () => void;
  destructive?: boolean;
  /** Shows a tick; for sheets that pick a value. */
  selected?: boolean;
  /** Leaves the sheet open, for picking several values. */
  keepOpen?: boolean;
}

interface ActionSheetProps {
  title?: string;
  actions: SheetAction[] | null;
  onClose: () => void;
}

/** Bottom sheet of actions or choices: where secondary actions and dropdowns live, instead of buttons on every card. */
export function ActionSheet({ title, actions, onClose }: ActionSheetProps) {
  const { colors, spacing, radius, typography, minTouch } = useTheme();
  const { bottom } = useSafeAreaInsets();
  const { height } = useWindowDimensions();

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
            maxHeight: height * 0.7,
          }}
        >
          {title ? (
            <Text style={{ ...typography.caption, color: colors.textMuted, textAlign: "center", marginBottom: spacing.sm }} numberOfLines={1}>
              {title}
            </Text>
          ) : null}
          <ScrollView>
            {actions?.map((action) => (
              <PressableScale
                key={action.label}
                accessibilityState={{ selected: action.selected }}
                onPress={() => {
                  if (!action.keepOpen) onClose();
                  action.onPress();
                }}
                style={{ minHeight: minTouch + spacing.sm, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: spacing.md }}
              >
                <Text style={{ ...typography.bodyStrong, color: action.destructive ? colors.criticalError : action.selected ? colors.brandAccent : colors.text }}>{action.label}</Text>
                {action.selected ? <Ionicons name="checkmark" size={20} color={colors.brandAccent} /> : <View />}
              </PressableScale>
            ))}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
