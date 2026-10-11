"use client";

import { Moon, Sun } from "lucide-react";
import { useThemeMode } from "@/features/graph-editor/ui/theme/theme";
import { actionStyles } from "@/components/ui/styles";
import { cn } from "@/lib/utils";

export function ContentThemeToggle({
  labels,
}: {
  labels: { lightTheme: string; darkTheme: string };
}) {
  const { theme, setTheme } = useThemeMode();
  const label = theme === "dark" ? labels.lightTheme : labels.darkTheme;
  const Icon = theme === "dark" ? Sun : Moon;
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
      className={cn(actionStyles(), "min-w-11 shrink-0 justify-center px-3")}
    >
      <Icon className="size-4" aria-hidden="true" />
    </button>
  );
}
