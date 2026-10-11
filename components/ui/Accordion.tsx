import type { ComponentPropsWithoutRef, ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Disclosure } from "./Disclosure";
import { panelSurface } from "./styles";

type AccordionItem = {
  id: string;
  title: ReactNode;
  content: ReactNode;
};

type AccordionProps = Omit<ComponentPropsWithoutRef<"div">, "children"> & {
  /** A nonempty name unique to this accordion on the page. */
  name: string;
  items: readonly AccordionItem[];
};

/** One shared surface; native details grouping keeps at most one item open. */
export function Accordion({
  name,
  items,
  className,
  ...props
}: AccordionProps) {
  return (
    <div
      {...props}
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
