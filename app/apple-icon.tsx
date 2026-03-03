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
        <svg width="180" height="180" viewBox="0 0 36 36" fill="none">
          <path
            d="M18 7L9 12V19.5C9 25 13 29.5 18 31C23 29.5 27 25 27 19.5V12L18 7Z"
            stroke="white"
            strokeWidth="1.5"
            strokeLinejoin="round"
            fill="none"
            opacity="0.5"
          />
          <path
            d="M12 19L16 23L24 13"
            stroke="white"
            strokeWidth="2.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>
    ),
    { ...size },
  );
}
