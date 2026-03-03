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
          position: 'relative',
        }}
      >
        {/* Short left arm of checkmark — rotates up-right from left tip */}
        <div
          style={{
            position: 'absolute',
            left: 36,
            top: 76,
            width: 43,
            height: 16,
            background: 'white',
            borderRadius: 8,
            transform: 'rotate(41deg)',
            transformOrigin: 'left center',
          }}
        />
        {/* Long right arm of checkmark — rotates up-right from junction */}
        <div
          style={{
            position: 'absolute',
            left: 68,
            top: 104,
            width: 91,
            height: 16,
            background: 'white',
            borderRadius: 8,
            transform: 'rotate(-40deg)',
            transformOrigin: 'left center',
          }}
        />
      </div>
    ),
    { ...size },
  );
}
