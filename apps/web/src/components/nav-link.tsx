import Link from "next/link";
import type { LinkComponentProps } from "@searchenvil/ui";

/** Adapts next/link to the framework-agnostic LinkComponent shape @searchenvil/ui expects. */
export function NavLink({ href, className, children, ...props }: LinkComponentProps): React.ReactElement {
  return (
    <Link href={href} className={className} {...props}>
      {children}
    </Link>
  );
}
