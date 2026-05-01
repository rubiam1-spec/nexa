export default function NexaIcon({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 512 512" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M40 0 H370 L512 142 V472 Q512 512 472 512 H40 Q0 512 0 472 V40 Q0 0 40 0 Z" fill="currentColor" opacity="0.15" />
      <polygon points="148,380 148,132 200,132 316,308 316,132 364,132 364,380 316,380 200,204 200,380" fill="#4ADE80" />
    </svg>
  );
}
