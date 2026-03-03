import { ImageResponse } from 'next/og';

export const size = { width: 192, height: 192 };
export const contentType = 'image/png';

export default function Icon() {
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
          borderRadius: '44px',
        }}
      >
        <svg width="108" height="108" viewBox="0 0 36 36" fill="none">
          <path
            d="M18 3L5 9V18C5 26 10.5 32.5 18 35C25.5 32.5 31 26 31 18V9L18 3Z"
            fill="white"
            fillOpacity="0.25"
          />
          <path
            d="M11 19L15 23L25 13"
            stroke="white"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>
    ),
    { ...size },
  );
}
