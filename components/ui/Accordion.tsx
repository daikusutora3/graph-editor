import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Disclosure } from "./Disclosure";
import { panelSurface } from "./styles";

type AccordionItem = {
  id: string;
  title: ReactNode;
  content: ReactNode;
};

type AccordionProps = {
  name: string;
  items: readonly AccordionItem[];
  className?: string;
};

export function Accordion({ name, items, className }: AccordionProps) {
  return (
    <div
      className={cn(
        panelSurface,
        "divide-y divide-[var(--line)] overflow-hidden",
        className,
      )}
    >
      {items.map((item) => (
        <Disclosure key={item.id} title={item.title} name={name} variant="row">
          {item.content}
        </Disclosure>
      ))}
    </div>
  );
}
