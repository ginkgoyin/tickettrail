import type { SVGProps } from "react";

type AppIconName = "help" | "close" | "trash";

interface AppIconProps extends Omit<SVGProps<SVGSVGElement>, "children"> {
  name: AppIconName;
  size?: number;
  title?: string;
}

function renderIconPath(name: AppIconName) {
  switch (name) {
    case "help":
      return (
        <>
          <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="1.8" />
          <path
            d="M9.4 9.35a2.78 2.78 0 0 1 5.17 1.38c0 1.82-1.95 2.37-2.57 3.38"
            fill="none"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="1.8"
          />
          <circle cx="12" cy="16.9" r="1" fill="currentColor" />
        </>
      );
    case "close":
      return (
        <path
          d="M6.7 6.7a1 1 0 0 1 1.4 0L12 10.59l3.9-3.9a1 1 0 1 1 1.4 1.42L13.41 12l3.9 3.9a1 1 0 0 1-1.42 1.4L12 13.41l-3.9 3.9a1 1 0 0 1-1.4-1.42l3.89-3.89-3.9-3.9a1 1 0 0 1 0-1.4Z"
          fill="currentColor"
        />
      );
    case "trash":
      return (
        <path
          d="M9 3h6l1 2h4v2H4V5h4l1-2Zm1 6h2v8h-2V9Zm4 0h2v8h-2V9ZM7 9h2v8H7V9Zm1 11a2 2 0 0 1-2-2V8h12v10a2 2 0 0 1-2 2H8Z"
          fill="currentColor"
        />
      );
    default:
      return null;
  }
}

export function AppIcon({ name, size = 18, title, className, ...rest }: AppIconProps) {
  const labelled = Boolean(title);

  return (
    <svg
      aria-hidden={labelled ? undefined : true}
      className={className}
      fill="none"
      focusable="false"
      height={size}
      role={labelled ? "img" : undefined}
      viewBox="0 0 24 24"
      width={size}
      {...rest}
    >
      {title ? <title>{title}</title> : null}
      {renderIconPath(name)}
    </svg>
  );
}
