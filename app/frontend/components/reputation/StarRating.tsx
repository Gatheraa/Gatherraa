"use client";

interface StarRatingProps {
  rating: number;   // 0–5, supports decimals
  size?: number;
  showValue?: boolean;
  color?: string;
}

export function StarRating({
  rating,
  size = 20,
  showValue = true,
  color = "#f59e0b",
}: StarRatingProps) {
  const clamped = Math.max(0, Math.min(5, rating));
  const id = `star-clip-${Math.random().toString(36).slice(2, 7)}`;

  return (
    <span className="star-rating" aria-label={`${clamped} out of 5 stars`}>
      <span className="stars-row" aria-hidden>
        {Array.from({ length: 5 }, (_, i) => {
          const fill = Math.max(0, Math.min(1, clamped - i));
          return (
            <span key={i} className="star-wrap" style={{ width: size, height: size }}>
              <svg
                width={size}
                height={size}
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <defs>
                  <clipPath id={`${id}-${i}`}>
                    <rect x="0" y="0" width={24 * fill} height="24" />
                  </clipPath>
                </defs>
                {/* Empty star */}
                <path
                  d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"
                  fill="#e5e7eb"
                />
                {/* Filled star (clipped) */}
                <path
                  d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"
                  fill={color}
                  clipPath={`url(#${id}-${i})`}
                />
              </svg>
            </span>
          );
        })}
      </span>
      {showValue && (
        <span className="star-value">{clamped.toFixed(1)}</span>
      )}
    </span>
  );
}