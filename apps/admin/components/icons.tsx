import type { SVGProps } from 'react';

type IconProps = SVGProps<SVGSVGElement>;

function IconFrame({ children, ...props }: IconProps) {
  return (
    <svg
      aria-hidden="true"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      {children}
    </svg>
  );
}

export const ShieldIcon = (props: IconProps) => (
  <IconFrame {...props}>
    <path d="M12 3 5 6v5c0 4.8 2.9 8.2 7 10 4.1-1.8 7-5.2 7-10V6l-7-3Z" />
    <path d="m9.3 12 1.8 1.8 3.8-4" />
  </IconFrame>
);

export const LockIcon = (props: IconProps) => (
  <IconFrame {...props}>
    <rect width="16" height="11" x="4" y="10" rx="2" />
    <path d="M8 10V7a4 4 0 0 1 8 0v3" />
  </IconFrame>
);

export const MailIcon = (props: IconProps) => (
  <IconFrame {...props}>
    <rect width="18" height="14" x="3" y="5" rx="2" />
    <path d="m3 7 9 6 9-6" />
  </IconFrame>
);

export const EyeIcon = ({
  crossed = false,
  ...props
}: IconProps & { crossed?: boolean }) => (
  <IconFrame {...props}>
    <path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z" />
    <circle cx="12" cy="12" r="2.5" />
    {crossed ? <path d="m4 4 16 16" /> : null}
  </IconFrame>
);

export const GridIcon = (props: IconProps) => (
  <IconFrame {...props}>
    <rect width="7" height="7" x="3" y="3" rx="1" />
    <rect width="7" height="7" x="14" y="3" rx="1" />
    <rect width="7" height="7" x="3" y="14" rx="1" />
    <rect width="7" height="7" x="14" y="14" rx="1" />
  </IconFrame>
);

export const LayersIcon = (props: IconProps) => (
  <IconFrame {...props}>
    <path d="m12 3-9 5 9 5 9-5-9-5Z" />
    <path d="m3 12 9 5 9-5M3 16l9 5 9-5" />
  </IconFrame>
);

export const CarIcon = (props: IconProps) => (
  <IconFrame {...props}>
    <path d="m5 16-1 2v2M19 16l1 2v2M5 16h14l-1-6-2-3H8l-2 3-1 6Z" />
    <path d="M7 16h.01M17 16h.01M6 11h12" />
  </IconFrame>
);

export const UsersIcon = (props: IconProps) => (
  <IconFrame {...props}>
    <circle cx="9" cy="8" r="3" />
    <path d="M3 21v-2a6 6 0 0 1 12 0v2M16 4.3a3 3 0 0 1 0 5.4M17 14a6 6 0 0 1 4 5.7V21" />
  </IconFrame>
);

export const StoreIcon = (props: IconProps) => (
  <IconFrame {...props}>
    <path d="M4 10v10h16V10" />
    <path d="M3 10 5 4h14l2 6" />
    <path d="M3 10a3 3 0 0 0 5 2 3 3 0 0 0 4 0 3 3 0 0 0 4 0 3 3 0 0 0 5-2" />
    <path d="M9 20v-5h6v5" />
  </IconFrame>
);

export const MenuIcon = (props: IconProps) => (
  <IconFrame {...props}>
    <path d="M4 7h16M4 12h16M4 17h16" />
  </IconFrame>
);

export const CloseIcon = (props: IconProps) => (
  <IconFrame {...props}>
    <path d="m6 6 12 12M18 6 6 18" />
  </IconFrame>
);

export const LogoutIcon = (props: IconProps) => (
  <IconFrame {...props}>
    <path d="M10 17l5-5-5-5M15 12H3M15 4h4a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-4" />
  </IconFrame>
);

export const ArrowIcon = (props: IconProps) => (
  <IconFrame {...props}>
    <path d="M5 12h14m-5-5 5 5-5 5" />
  </IconFrame>
);

export const CheckIcon = (props: IconProps) => (
  <IconFrame {...props}>
    <path d="m5 12 4 4L19 6" />
  </IconFrame>
);

export const KeyIcon = (props: IconProps) => (
  <IconFrame {...props}>
    <circle cx="8" cy="15" r="4" />
    <path d="m11 12 8-8M15 8l3 3M17 6l2 2" />
  </IconFrame>
);

export const ActivityIcon = (props: IconProps) => (
  <IconFrame {...props}>
    <path d="M3 12h4l2-7 4 14 2-7h6" />
  </IconFrame>
);


export const SearchIcon = (props: IconProps) => (
  <IconFrame {...props}>
    <circle cx="11" cy="11" r="6.5" />
    <path d="m16 16 4 4" />
  </IconFrame>
);
