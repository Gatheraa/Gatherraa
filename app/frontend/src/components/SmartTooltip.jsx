import React, { useState, useRef, useEffect } from 'react';
import clsx from 'clsx';

export default function SmartTooltip({
  children,
  content,
  trigger = 'hover', // 'hover' or 'click'
  delay = 200,
}) {
  const [visible, setVisible] = useState(false);
  const [position, setPosition] = useState('top');
  const timeoutRef = useRef(null);
  const wrapperRef = useRef(null);

  const show = () => {
    timeoutRef.current = setTimeout(() => setVisible(true), delay);
  };

  const hide = () => {
    clearTimeout(timeoutRef.current);
    setVisible(false);
  };

  const toggle = () => setVisible((v) => !v);

  useEffect(() => {
    if (visible && wrapperRef.current) {
      const rect = wrapperRef.current.getBoundingClientRect();
      const viewportHeight = window.innerHeight;
      setPosition(rect.top < viewportHeight / 2 ? 'bottom' : 'top');
    }
  }, [visible]);

  const triggerProps =
    trigger === 'hover'
      ? { onMouseEnter: show, onMouseLeave: hide }
      : { onClick: toggle };

  return (
    <span className="relative inline-block" ref={wrapperRef} {...triggerProps}>
      {children}
      {visible && (
        <div
          role="tooltip"
          className={clsx(
            "absolute z-50 px-3 py-2 text-sm rounded shadow-lg bg-gray-800 text-white",
            position === 'top' ? "bottom-full mb-2" : "top-full mt-2"
          )}
        >
          {content}
        </div>
      )}
    </span>
  );
}
