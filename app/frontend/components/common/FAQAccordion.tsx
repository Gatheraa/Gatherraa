import React, { useState, useRef, useCallback } from 'react';
import { ChevronDown } from 'lucide-react';

interface FAQItem {
  id: string;
  question: string;
  answer: string;
}

interface FAQAccordionProps {
  items: FAQItem[];
  allowMultipleOpen?: boolean;
  defaultOpenIds?: string[];
  onItemToggle?: (id: string, isOpen: boolean) => void;
  className?: string;
}

export const FAQAccordion: React.FC<FAQAccordionProps> = ({
  items,
  allowMultipleOpen = false,
  defaultOpenIds = [],
  onItemToggle,
  className = '',
}) => {
  const [openIds, setOpenIds] = useState<Set<string>>(new Set(defaultOpenIds));
  const contentRefs = useRef<{ [key: string]: HTMLDivElement | null }>({});
  const [heights, setHeights] = useState<{ [key: string]: number }>({});

  const toggleItem = useCallback(
    (id: string) => {
      setOpenIds((prevOpenIds) => {
        const newOpenIds = new Set(prevOpenIds);
        const isCurrentlyOpen = newOpenIds.has(id);

        if (!allowMultipleOpen) {
          newOpenIds.clear();
        }

        if (isCurrentlyOpen) {
          newOpenIds.delete(id);
        } else {
          newOpenIds.add(id);
        }

        onItemToggle?.(id, !isCurrentlyOpen);
        return newOpenIds;
      });
    },
    [allowMultipleOpen, onItemToggle]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLButtonElement>, itemId: string) => {
      const itemIndex = items.findIndex((item) => item.id === itemId);

      switch (e.key) {
        case 'Enter':
        case ' ':
          e.preventDefault();
          toggleItem(itemId);
          break;
        case 'ArrowDown':
          e.preventDefault();
          if (itemIndex < items.length - 1) {
            const nextButton = document.querySelector(
              `[data-faq-id="${items[itemIndex + 1].id}"]`
            ) as HTMLButtonElement;
            nextButton?.focus();
          }
          break;
        case 'ArrowUp':
          e.preventDefault();
          if (itemIndex > 0) {
            const prevButton = document.querySelector(
              `[data-faq-id="${items[itemIndex - 1].id}"]`
            ) as HTMLButtonElement;
            prevButton?.focus();
          }
          break;
        case 'Home':
          e.preventDefault();
          (document.querySelector(`[data-faq-id="${items[0].id}"]`) as HTMLButtonElement)?.focus();
          break;
        case 'End':
          e.preventDefault();
          (
            document.querySelector(
              `[data-faq-id="${items[items.length - 1].id}"]`
            ) as HTMLButtonElement
          )?.focus();
          break;
      }
    },
    [items, toggleItem]
  );

  const handleContentLoad = useCallback((id: string) => {
    const contentDiv = contentRefs.current[id];
    if (contentDiv) {
      setHeights((prev) => ({
        ...prev,
        [id]: contentDiv.scrollHeight,
      }));
    }
  }, []);

  React.useEffect(() => {
    items.forEach((item) => {
      handleContentLoad(item.id);
    });
  }, [items, handleContentLoad]);

  return (
    <div className={`faq-accordion-root ${className}`}>
      <div className="faq-accordion">
        {items.map((item) => {
          const isOpen = openIds.has(item.id);
          const contentHeight = isOpen ? heights[item.id] || 0 : 0;

          return (
            <div
              key={item.id}
              className="faq-item"
              data-open={isOpen}
            >
              <button
                className="faq-button"
                onClick={() => toggleItem(item.id)}
                onKeyDown={(e) => handleKeyDown(e, item.id)}
                aria-expanded={isOpen}
                aria-controls={`faq-content-${item.id}`}
                data-faq-id={item.id}
              >
                <span className="faq-question">{item.question}</span>
                <span className="faq-icon" aria-hidden="true">
                  <ChevronDown size={20} />
                </span>
              </button>

              <div
                id={`faq-content-${item.id}`}
                className="faq-content-wrapper"
                style={{
                  maxHeight: `${contentHeight}px`,
                }}
                role="region"
                aria-labelledby={`faq-button-${item.id}`}
              >
                <div
                  ref={(el) => {
                    contentRefs.current[item.id] = el;
                  }}
                  className="faq-content"
                  onLoad={() => handleContentLoad(item.id)}
                >
                  {item.answer}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <style jsx>{`
        .faq-accordion-root {
          font-family: 'DM Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
          --accent: #c8f04e;
          --text-primary: #f0ede8;
          --text-muted: #888;
          --border-color: rgba(255, 255, 255, 0.1);
          --interactive-bg: rgba(200, 240, 78, 0.05);
          --interactive-bg-hover: rgba(200, 240, 78, 0.1);
        }

        .faq-accordion {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
          width: 100%;
          max-width: 100%;
        }

        .faq-item {
          border: 1px solid var(--border-color);
          border-radius: 12px;
          overflow: hidden;
          background: rgba(14, 14, 14, 0.5);
          transition: background-color 0.2s ease, border-color 0.2s ease;
        }

        .faq-item[data-open='true'] {
          background: var(--interactive-bg);
          border-color: var(--accent);
          border-color: rgba(200, 240, 78, 0.3);
        }

        .faq-button {
          width: 100%;
          padding: 1.25rem 1.5rem;
          background: none;
          border: none;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 1rem;
          color: var(--text-primary);
          font-size: 1rem;
          font-weight: 500;
          text-align: left;
          transition: all 0.2s ease;
          position: relative;
        }

        .faq-button:hover {
          background: var(--interactive-bg-hover);
        }

        .faq-button:focus {
          outline: 2px solid var(--accent);
          outline-offset: -2px;
        }

        .faq-button:focus:not(:focus-visible) {
          outline: none;
        }

        .faq-button:focus-visible {
          outline: 2px solid var(--accent);
          outline-offset: -2px;
        }

        .faq-question {
          flex: 1;
          display: flex;
          align-items: center;
        }

        .faq-icon {
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          color: var(--accent);
          transition: transform 0.3s cubic-bezier(0.23, 1, 0.32, 1);
        }

        .faq-item[data-open='true'] .faq-icon {
          transform: rotate(180deg);
        }

        .faq-content-wrapper {
          overflow: hidden;
          transition: max-height 0.3s cubic-bezier(0.23, 1, 0.32, 1);
        }

        .faq-content {
          padding: 0 1.5rem 1.25rem 1.5rem;
          color: var(--text-muted);
          font-size: 0.95rem;
          line-height: 1.6;
        }

        .faq-content a {
          color: var(--accent);
          text-decoration: none;
          transition: opacity 0.2s ease;
        }

        .faq-content a:hover {
          opacity: 0.8;
          text-decoration: underline;
        }

        .faq-content a:focus {
          outline: 2px solid var(--accent);
          outline-offset: 2px;
          border-radius: 2px;
        }

        /* Support for markdown-like content */
        .faq-content p {
          margin: 0.5rem 0;
        }

        .faq-content p:first-child {
          margin-top: 0;
        }

        .faq-content p:last-child {
          margin-bottom: 0;
        }

        .faq-content ul,
        .faq-content ol {
          margin: 0.75rem 0;
          padding-left: 1.5rem;
        }

        .faq-content li {
          margin: 0.5rem 0;
        }

        .faq-content code {
          background: rgba(200, 240, 78, 0.1);
          color: var(--accent);
          padding: 0.2rem 0.6rem;
          border-radius: 4px;
          font-family: 'Monaco', 'Courier New', monospace;
          font-size: 0.9em;
        }

        /* Animations */
        @media (prefers-reduced-motion: reduce) {
          .faq-icon,
          .faq-content-wrapper,
          .faq-button {
            transition: none;
          }
        }
      `}</style>
    </div>
  );
};

export default FAQAccordion;
