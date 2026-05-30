import { ExternalLink } from "lucide-react";
import type { ComponentType, SVGProps } from "react";

import { cn } from "@/lib/utils";

const AUTHOR_LINKS: {
  href: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  iconClassName: string;
  label: string;
  meta: string;
}[] = [
  {
    href: "https://www.youtube.com/@daikusutora-dayo",
    icon: YouTubeLogo,
    iconClassName: "text-[#ff0033]",
    label: "YouTube",
    meta: "@daikusutora-dayo",
  },
  {
    href: "https://x.com/daikusutora3",
    icon: XLogo,
    iconClassName: "text-[var(--text)]",
    label: "X",
    meta: "@daikusutora3",
  },
  {
    href: "https://github.com/daikusutora3",
    icon: GitHubLogo,
    iconClassName: "text-[var(--text)]",
    label: "GitHub",
    meta: "daikusutora3",
  },
];

type AuthorProfileMenuProps = {
  panelState?: "open" | "closing";
};

export function AuthorProfileMenu({
  panelState = "open",
}: AuthorProfileMenuProps) {
  return (
    <div
      role="menu"
      aria-label="Profile links"
      data-panel-state={panelState}
      className="gv-author-menu gv-popover pointer-events-auto absolute bottom-[calc(100%+0.5rem)] left-1/2 z-[100] flex w-56 flex-col gap-1 p-1.5 text-left"
    >
      {AUTHOR_LINKS.map(({ href, icon: Icon, iconClassName, label, meta }) => (
        <a
          key={href}
          href={href}
          target="_blank"
          rel="noreferrer"
          role="menuitem"
          className="grid min-w-0 grid-cols-[1.75rem_minmax(0,1fr)_auto] items-center gap-2 rounded-[var(--app-radius-md)] px-2 py-1.5 text-[var(--text-dim)] transition-colors hover:bg-[var(--state-hover-bg)] hover:text-[var(--state-hover-text)] focus-visible:ring-2 focus-visible:ring-[var(--state-focus-ring)] focus-visible:outline-none"
        >
          <span className="grid size-7 place-items-center rounded-[var(--app-radius-sm)] bg-[var(--state-control-bg)]">
            <Icon className={cn("size-4", iconClassName)} aria-hidden="true" />
          </span>
          <span className="flex min-w-0 flex-col gap-0.5">
            <span className="truncate text-[length:var(--app-text-xs)] leading-none font-bold">
              {label}
            </span>
            <span className="truncate text-[0.6875rem] leading-none font-medium text-[var(--text-mute)]">
              {meta}
            </span>
          </span>
          <ExternalLink className="size-3.5 text-[var(--text-mute)]" />
        </a>
      ))}
    </div>
  );
}

function YouTubeLogo(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" {...props}>
      <path
        fill="currentColor"
        d="M23.5 6.2a3 3 0 0 0-2.1-2.1C19.5 3.6 12 3.6 12 3.6s-7.5 0-9.4.5A3 3 0 0 0 .5 6.2 31 31 0 0 0 0 12a31 31 0 0 0 .5 5.8 3 3 0 0 0 2.1 2.1c1.9.5 9.4.5 9.4.5s7.5 0 9.4-.5a3 3 0 0 0 2.1-2.1A31 31 0 0 0 24 12a31 31 0 0 0-.5-5.8Z"
      />
      <path fill="var(--surface)" d="M9.6 15.5v-7l6.2 3.5-6.2 3.5Z" />
    </svg>
  );
}

export function XLogo(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
      <path d="M18.24 2.25h3.31l-7.23 8.26 8.5 11.24h-6.66l-5.21-6.82-5.97 6.82H1.67l7.73-8.84L1.25 2.25h6.83l4.71 6.23 5.45-6.23Zm-1.16 17.52h1.83L7.08 4.13H5.12l11.96 15.64Z" />
    </svg>
  );
}

export function GitHubLogo(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M12 .5C5.65.5.5 5.65.5 12c0 5.08 3.29 9.39 7.85 10.91.57.11.78-.25.78-.55v-2.02c-3.19.69-3.86-1.37-3.86-1.37-.52-1.32-1.27-1.67-1.27-1.67-1.04-.71.08-.7.08-.7 1.15.08 1.76 1.18 1.76 1.18 1.02 1.75 2.68 1.25 3.34.95.1-.74.4-1.25.72-1.53-2.55-.29-5.23-1.28-5.23-5.68 0-1.26.45-2.28 1.18-3.08-.12-.29-.51-1.46.11-3.04 0 0 .96-.31 3.16 1.18A11 11 0 0 1 12 6.19c.98 0 1.96.13 2.88.39 2.19-1.49 3.15-1.18 3.15-1.18.63 1.58.24 2.75.12 3.04.74.8 1.18 1.82 1.18 3.08 0 4.41-2.69 5.38-5.25 5.67.41.36.78 1.06.78 2.14v3.03c0 .3.21.67.79.55A11.5 11.5 0 0 0 23.5 12C23.5 5.65 18.35.5 12 .5Z"
      />
    </svg>
  );
}
