interface IconProps {
  className?: string;
}

const SHARED_PROPS = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.5,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

/** A magnifying glass over a checklist — SEO professionals investigating findings. */
export function SearchAuditIcon({ className }: IconProps): React.ReactElement {
  return (
    <svg {...SHARED_PROPS} className={className} aria-hidden="true">
      <rect x="3" y="3" width="12" height="15" rx="1.5" />
      <path d="M6.5 7.5h5M6.5 10.5h5M6.5 13.5h2.5" />
      <circle cx="16.5" cy="16.5" r="3.5" />
      <path d="M19.2 19.2 21.5 21.5" />
    </svg>
  );
}

/** Layered/stacked panes — multiple client organizations managed from one place. */
export function OrganizationsIcon({ className }: IconProps): React.ReactElement {
  return (
    <svg {...SHARED_PROPS} className={className} aria-hidden="true">
      <rect x="6" y="3" width="15" height="10" rx="1.5" />
      <rect x="2.5" y="8.5" width="15" height="10" rx="1.5" fill="none" />
    </svg>
  );
}

/** A rising line with a marked delta — tracking Search Health over time. */
export function TrendIcon({ className }: IconProps): React.ReactElement {
  return (
    <svg {...SHARED_PROPS} className={className} aria-hidden="true">
      <path d="M3 18 9 11l4 4 8-9" />
      <path d="M15 5h5v5" />
    </svg>
  );
}
