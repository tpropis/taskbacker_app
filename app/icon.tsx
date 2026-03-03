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
        }}
      >
        <svg width="192" height="192" viewBox="0 0 192 192" fill="none">
          {/* Shield outline — stroke only, clearly visible */}
          <path
            d="M96 38L48 64V104C48 133 69 157 96 165C123 157 144 133 144 104V64Z"
            stroke="white"
            strokeWidth="8"
            strokeLinejoin="round"
            fill="none"
            opacity="0.5"
          />
          {/* Checkmark */}
          <path
            d="M66 104L85 124L127 74"
            stroke="white"
            strokeWidth="15"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>
    ),
    { ...size },
  );
}
