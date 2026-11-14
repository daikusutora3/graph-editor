"use client";

import { Button, type ButtonProps } from "./Button";

export function ChoiceButton(
  props: Omit<ButtonProps, "layout" | "size" | "wrap">,
) {
  return <Button variant="choice" layout="compact" {...props} />;
}
