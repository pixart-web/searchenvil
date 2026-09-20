import Link from "next/link";
import type { LinkComponentProps } from "@searchanvil/ui";

/** Adapts next/link to the framework-agnostic LinkComponent shape @searchanvil/ui expects. */
export function NavLink({ href, className, children, ...props }: LinkComponentProps): React.ReactElement {
  return (
    <Link href={href} className={className} {...props}>
      {children}
    </Link>
  );
}
