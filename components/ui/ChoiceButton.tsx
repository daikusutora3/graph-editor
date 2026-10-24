"use client";

import { Button, type ButtonProps } from "./Button";

export function ChoiceButton({
  layout = "inline",
  ...props
}: Omit<ButtonProps, "layout"> & { layout?: "inline" | "tile" }) {
  return (
    <Button
      size="lg"
      variant="choice"
      wrap
      layout={layout === "tile" ? "tile" : "compact"}
      {...props}
    />
  );
}
