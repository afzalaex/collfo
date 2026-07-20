"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

export function SupportModal() {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (!isOpen) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [isOpen]);

  function handleOpen() {
    setIsOpen(true);
  }

  function handleClose() {
    setIsOpen(false);
  }

  return (
    <>
      <button
        type="button"
        className="layout-action-link"
        onClick={handleOpen}
      >
        Support
      </button>

      {isOpen &&
        createPortal(
          <div className="contact-overlay" role="presentation" onClick={handleClose}>
            <div
              className="contact-modal"
              role="dialog"
              aria-modal="true"
              aria-labelledby="support-modal-title"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="contact-modal-header">
                <div className="contact-modal-copy">
                  <p id="support-modal-title" className="mail-box-title">
                    Support
                  </p>
                </div>
                <button
                  className="contact-close"
                  type="button"
                  aria-label="Close modal"
                  onClick={handleClose}
                />
              </div>

              <div className="mail-box" style={{ padding: "16px 20px" }}>
                <p style={{ margin: 0, lineHeight: 1.5 }}>
                  The best way to support me would be by collecting my daily art practice{" "}
                  <a
                    href="https://mint.networked.art/0x237047f8b97ab581974acaec36e6abba793a29b1/0x0f3f91d3dee2d6172a3c496b392ebeaa26318842"
                    target="_blank"
                    rel="noreferrer"
                    style={{ textDecoration: "underline" }}
                  >
                    e/very days
                  </a>.
                </p>
              </div>
            </div>
          </div>,
          document.body
        )}
    </>
  );
}
