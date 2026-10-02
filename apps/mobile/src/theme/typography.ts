import { Platform } from "react-native";

// Semantic roles mapped to San Francisco (iOS text styles) and Roboto (Material 3 type
// scale). Text scales with the system font size (Dynamic Type / font scale) by default.
interface Role {
  fontSize: number;
  lineHeight: number;
  fontWeight: "400" | "500" | "600" | "700";
  letterSpacing?: number;
}
type Roles = Record<"display" | "title" | "heading" | "body" | "bodyStrong" | "caption" | "label", Role>;

const ios: Roles = {
  display: { fontSize: 34, lineHeight: 41, fontWeight: "700", letterSpacing: -0.6 }, // Large Title
  title: { fontSize: 28, lineHeight: 34, fontWeight: "700", letterSpacing: -0.4 }, // Title 1
  heading: { fontSize: 17, lineHeight: 22, fontWeight: "600", letterSpacing: -0.2 }, // Headline
  body: { fontSize: 17, lineHeight: 25, fontWeight: "400" }, // Body, looser leading
  bodyStrong: { fontSize: 17, lineHeight: 25, fontWeight: "600" },
  caption: { fontSize: 13, lineHeight: 18, fontWeight: "500" }, // Footnote
  label: { fontSize: 12, lineHeight: 16, fontWeight: "600", letterSpacing: 0.4 }, // Caption 1
};

const android: Roles = {
  display: { fontSize: 32, lineHeight: 40, fontWeight: "600", letterSpacing: -0.4 }, // Headline Large
  title: { fontSize: 24, lineHeight: 32, fontWeight: "600", letterSpacing: -0.2 }, // Headline Small
  heading: { fontSize: 16, lineHeight: 24, fontWeight: "600" }, // Title Medium
  body: { fontSize: 16, lineHeight: 24, fontWeight: "400" }, // Body Large
  bodyStrong: { fontSize: 16, lineHeight: 24, fontWeight: "600" },
  caption: { fontSize: 14, lineHeight: 20, fontWeight: "500" }, // Label Large
  label: { fontSize: 12, lineHeight: 16, fontWeight: "600", letterSpacing: 0.5 }, // Label Medium
};

export const typography = Platform.OS === "ios" ? ios : android;
