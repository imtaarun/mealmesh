import { router } from "expo-router";
import { RecipeBrowser } from "@/components/recipe/RecipeBrowser";

export default function DiscoverScreen() {
  return (
    <RecipeBrowser
      title="Discover"
      subtitle="Every dish is costed and ready for cooking mode."
      onPick={(recipe) => router.push({ pathname: "/recipe/[id]", params: { id: recipe.id } })}
    />
  );
}
