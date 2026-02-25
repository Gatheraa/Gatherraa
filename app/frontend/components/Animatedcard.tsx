import { useState } from "react";

interface CardProps {
  image: string;
  title: string;
  description: string;
  tag?: string;
  ctaLabel?: string;
  onCtaClick?: () => void;
}

const cardStyles = `
  @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@500;700&family=DM+Sans:wght@300;400;500&display=swap');

  .card-root {
    font-family: 'DM Sans', sans-serif;
    --card-bg: #0e0e0e;
    --card-border: rgba(255,255,255,0.07);
    --accent: #c8f04e;
    --text-primary: #f0ede8;
    --text-muted: #888;
  }

  .card {
    position: relative;
    width: 320px;
    background: var(--card-bg);
    border: 1px solid var(--card-border);
    border-radius: 16px;
    overflow: hidden;
    cursor: pointer;
    transition: transform 0.4s cubic-bezier(0.23, 1, 0.32, 1),
                box-shadow 0.4s cubic-bezier(0.23, 1, 0.32, 1),
                border-color 0.4s ease;
    box-shadow: 0 2px 8px rgba(0,0,0,0.4);
  }

  .card:hover {
    transform: translateY(-6px) scale(1.015);
    box-shadow: 0 24px 60px rgba(0,0,0,0.6), 0 0 0 1px rgba(200,240,78,0.15);
    border-color: rgba(200,240,78,0.2);
  }

  .card-image-wrapper {
    position: relative;
    width: 100%;
    height: 200px;
    overflow: hidden;
    background: #1a1a1a;
  }

  .card-image {
    width: 100%;
    height: 100%;
    object-fit: cover;
    opacity: 0;
    transition: opacity 0.7s ease, transform 0.6s cubic-bezier(0.23, 1, 0.32, 1);
    transform: scale(1.04);
  }

  .card-image.loaded {
    opacity: 1;
    transform: scale(1);
  }

  .card:hover .card-image {
    transform: scale(1.06);
  }

  .card-image-overlay {
    position: absolute;
    inset: 0;
    background: linear-gradient(to bottom, transparent 40%, rgba(14,14,14,0.85));
  }

  .card-tag {
    position: absolute;
    top: 12px;
    left: 12px;
    background: var(--accent);
    color: #000;
    font-size: 10px;
    font-weight: 600;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    padding: 4px 10px;
    border-radius: 100px;
  }

  .card-body {
    padding: 20px;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .card-title {
    font-family: 'Playfair Display', serif;
    font-size: 20px;
    font-weight: 700;
    color: var(--text-primary);
    line-height: 1.3;
    margin: 0;
  }

  .card-description {
    font-size: 13.5px;
    color: var(--text-muted);
    line-height: 1.65;
    margin: 0;
  }

  .card-footer {
    padding: 0 20px 20px;
  }

  .card-btn {
    width: 100%;
    padding: 11px 0;
    background: transparent;
    border: 1px solid rgba(255,255,255,0.12);
    border-radius: 10px;
    color: var(--text-primary);
    font-family: 'DM Sans', sans-serif;
    font-size: 13px;
    font-weight: 500;
    letter-spacing: 0.04em;
    cursor: pointer;
    position: relative;
    overflow: hidden;
    transition: border-color 0.3s ease, color 0.3s ease;
  }

  .card-btn::before {
    content: '';
    position: absolute;
    inset: 0;
    background: var(--accent);
    transform: translateY(100%);
    transition: transform 0.35s cubic-bezier(0.23, 1, 0.32, 1);
    z-index: 0;
  }

  .card-btn:hover::before {
    transform: translateY(0);
  }

  .card-btn:hover {
    color: #000;
    border-color: var(--accent);
  }

  .card-btn span {
    position: relative;
    z-index: 1;
  }

  .card-skeleton {
    width: 100%;
    height: 100%;
    background: linear-gradient(90deg, #1a1a1a 25%, #252525 50%, #1a1a1a 75%);
    background-size: 200% 100%;
    animation: shimmer 1.6s infinite;
  }

  @keyframes shimmer {
    0% { background-position: 200% 0; }
    100% { background-position: -200% 0; }
  }
`;

export default function AnimatedCard({
  image,
  title,
  description,
  tag,
  ctaLabel = "Explore",
  onCtaClick,
}: CardProps) {
  const [imgLoaded, setImgLoaded] = useState(false);

  return (
    <div className="card-root">
      <style>{cardStyles}</style>
      <div className="card">
        <div className="card-image-wrapper">
          {!imgLoaded && <div className="card-skeleton" />}
          <img
            src={image}
            alt={title}
            className={`card-image${imgLoaded ? " loaded" : ""}`}
            onLoad={() => setImgLoaded(true)}
          />
          <div className="card-image-overlay" />
          {tag && <span className="card-tag">{tag}</span>}
        </div>

        <div className="card-body">
          <h3 className="card-title">{title}</h3>
          <p className="card-description">{description}</p>
        </div>

        <div className="card-footer">
          <button className="card-btn" onClick={onCtaClick}>
            <span>{ctaLabel}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
