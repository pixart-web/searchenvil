import type { ComponentType } from "react";

/**
 * Layout components accept a `linkComponent` so this package stays
 * framework-agnostic (no hard dependency on next/link) while apps/web can
 * inject Next's Link for client-side transitions and prefetching.
 */
export type LinkComponentProps = {
  href: string;
  className?: string;
  children?: React.ReactNode;
  "aria-current"?: "page" | undefined;
  onClick?: () => void;
};

export type LinkComponent = ComponentType<LinkComponentProps>;

export function DefaultLink({ href, ...props }: LinkComponentProps): React.ReactElement {
  return <a href={href} {...props} />;
}

export interface NavItemDefinition {
  label: string;
  href: string;
  /** Matched with startsWith against the current path to determine active state. */
  matchPrefix?: string;
}
