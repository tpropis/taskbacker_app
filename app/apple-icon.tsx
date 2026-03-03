import { ImageResponse } from 'next/og';

export const size = { width: 180, height: 180 };
export const contentType = 'image/png';

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          background: '#4f46e5',
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <svg width="180" height="180" viewBox="0 0 180 180" fill="none">
          {/* Shield outline — stroke only, clearly visible */}
          <path
            d="M90 35L45 60V97.5C45 125 65 147.5 90 155C115 147.5 135 125 135 97.5V60Z"
            stroke="white"
            strokeWidth="7"
            strokeLinejoin="round"
            fill="none"
            opacity="0.5"
          />
          {/* Checkmark */}
          <path
            d="M62 97L80 116L118 68"
            stroke="white"
            strokeWidth="14"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>
    ),
    { ...size },
  );
}
