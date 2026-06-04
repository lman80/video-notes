type P = { size?: number; className?: string }
const svg = (children: JSX.Element, size = 18, className?: string): JSX.Element => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    aria-hidden="true"
  >
    {children}
  </svg>
)

export const PlayIcon = ({ size, className }: P): JSX.Element =>
  svg(<polygon points="6 4 20 12 6 20 6 4" fill="currentColor" stroke="none" />, size, className)
export const PauseIcon = ({ size, className }: P): JSX.Element =>
  svg(
    <>
      <rect x="6" y="4" width="4" height="16" rx="1" fill="currentColor" stroke="none" />
      <rect x="14" y="4" width="4" height="16" rx="1" fill="currentColor" stroke="none" />
    </>,
    size,
    className
  )
export const StepBackIcon = ({ size, className }: P): JSX.Element =>
  svg(
    <>
      <polygon points="19 5 9 12 19 19 19 5" fill="currentColor" stroke="none" />
      <line x1="5" y1="5" x2="5" y2="19" />
    </>,
    size,
    className
  )
export const StepFwdIcon = ({ size, className }: P): JSX.Element =>
  svg(
    <>
      <polygon points="5 5 15 12 5 19 5 5" fill="currentColor" stroke="none" />
      <line x1="19" y1="5" x2="19" y2="19" />
    </>,
    size,
    className
  )
export const VolumeIcon = ({ size, className }: P): JSX.Element =>
  svg(
    <>
      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" fill="currentColor" stroke="none" />
      <path d="M15.5 8.5a5 5 0 0 1 0 7" />
      <path d="M18.5 6a9 9 0 0 1 0 12" />
    </>,
    size,
    className
  )
export const MuteIcon = ({ size, className }: P): JSX.Element =>
  svg(
    <>
      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" fill="currentColor" stroke="none" />
      <line x1="22" y1="9" x2="16" y2="15" />
      <line x1="16" y1="9" x2="22" y2="15" />
    </>,
    size,
    className
  )
export const FullscreenIcon = ({ size, className }: P): JSX.Element =>
  svg(
    <>
      <path d="M8 3H5a2 2 0 0 0-2 2v3" />
      <path d="M16 3h3a2 2 0 0 1 2 2v3" />
      <path d="M8 21H5a2 2 0 0 1-2-2v-3" />
      <path d="M16 21h3a2 2 0 0 0 2-2v-3" />
    </>,
    size,
    className
  )
export const PlusIcon = ({ size, className }: P): JSX.Element =>
  svg(
    <>
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </>,
    size,
    className
  )
export const PenIcon = ({ size, className }: P): JSX.Element =>
  svg(<path d="M12 19l7-7 3 3-7 7-3-3z M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z M2 2l7.586 7.586" />, size, className)
export const RectIcon = ({ size, className }: P): JSX.Element =>
  svg(<rect x="3" y="5" width="18" height="14" rx="2" />, size, className)
export const EllipseIcon = ({ size, className }: P): JSX.Element =>
  svg(<ellipse cx="12" cy="12" rx="9" ry="7" />, size, className)
export const ArrowIcon = ({ size, className }: P): JSX.Element =>
  svg(
    <>
      <line x1="5" y1="19" x2="19" y2="5" />
      <polyline points="10 5 19 5 19 14" />
    </>,
    size,
    className
  )
export const UndoIcon = ({ size, className }: P): JSX.Element =>
  svg(
    <>
      <path d="M3 7v6h6" />
      <path d="M3 13a9 9 0 1 0 3-7.7L3 8" />
    </>,
    size,
    className
  )
export const TrashIcon = ({ size, className }: P): JSX.Element =>
  svg(
    <>
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
      <path d="M10 11v6 M14 11v6 M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
    </>,
    size,
    className
  )
export const CloseIcon = ({ size, className }: P): JSX.Element =>
  svg(
    <>
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </>,
    size,
    className
  )
export const BackIcon = ({ size, className }: P): JSX.Element =>
  svg(
    <>
      <line x1="19" y1="12" x2="5" y2="12" />
      <polyline points="12 19 5 12 12 5" />
    </>,
    size,
    className
  )
export const EditIcon = ({ size, className }: P): JSX.Element =>
  svg(
    <>
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
      <path d="M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
    </>,
    size,
    className
  )
export const ExportIcon = ({ size, className }: P): JSX.Element =>
  svg(
    <>
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </>,
    size,
    className
  )
export const JumpIcon = ({ size, className }: P): JSX.Element =>
  svg(
    <>
      <polygon points="5 4 15 12 5 20 5 4" fill="currentColor" stroke="none" />
      <line x1="19" y1="5" x2="19" y2="19" />
    </>,
    size,
    className
  )
export const PanelIcon = ({ size, className }: P): JSX.Element =>
  svg(
    <>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <line x1="15" y1="4" x2="15" y2="20" />
    </>,
    size,
    className
  )
export const ImportIcon = ({ size, className }: P): JSX.Element =>
  svg(
    <>
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 9 12 14 17 9" />
      <line x1="12" y1="2" x2="12" y2="14" />
    </>,
    size,
    className
  )
export const ChevronRightIcon = ({ size, className }: P): JSX.Element =>
  svg(<polyline points="9 6 15 12 9 18" />, size, className)
export const AudioIcon = ({ size, className }: P): JSX.Element =>
  svg(
    <>
      <line x1="4" y1="10" x2="4" y2="14" />
      <line x1="8" y1="6" x2="8" y2="18" />
      <line x1="12" y1="3" x2="12" y2="21" />
      <line x1="16" y1="7" x2="16" y2="17" />
      <line x1="20" y1="10" x2="20" y2="14" />
    </>,
    size,
    className
  )
export const PersonIcon = ({ size, className }: P): JSX.Element =>
  svg(
    <>
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </>,
    size,
    className
  )
