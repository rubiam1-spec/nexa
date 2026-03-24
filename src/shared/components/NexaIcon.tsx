export default function NexaIcon({ size = 22 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 40"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M4 4V36H36V12L28 4H4Z"
        stroke="#FAF9F6"
        strokeWidth="2"
        strokeLinejoin="round"
        fill="none"
      />
      <rect x="12" y="12" width="3.5" height="16" fill="#4ADE80" />
      <rect x="24" y="12" width="3.5" height="16" fill="#4ADE80" />
      <path d="M12 28L15.5 28L27.5 12L24 12Z" fill="#4ADE80" />
    </svg>
  );
}
