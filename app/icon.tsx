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
          position: 'relative',
        }}
      >
        {/* Short left arm */}
        <div
          style={{
            position: 'absolute',
            left: 38,
            top: 81,
            width: 46,
            height: 17,
            background: 'white',
            borderRadius: 9,
            transform: 'rotate(41deg)',
            transformOrigin: 'left center',
          }}
        />
        {/* Long right arm */}
        <div
          style={{
            position: 'absolute',
            left: 73,
            top: 111,
            width: 97,
            height: 17,
            background: 'white',
            borderRadius: 9,
            transform: 'rotate(-40deg)',
            transformOrigin: 'left center',
          }}
        />
      </div>
    ),
    { ...size },
  );
}
