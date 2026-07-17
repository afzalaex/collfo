"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

const CONTACT_EMAIL = "afzalaex@gmail.com";
const FORM_ENDPOINT = `https://formsubmit.co/ajax/${CONTACT_EMAIL}`;

export function FeedbackForm() {
  const [isOpen, setIsOpen] = useState(false);
  const [name, setName] = useState("");
  const [idea, setIdea] = useState("");
  // Honeypot field for spam bots
  const [website, setWebsite] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [statusTone, setStatusTone] = useState<"success" | "error" | null>(null);

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
    setStatusMessage(null);
    setStatusTone(null);
    setIsOpen(true);
  }

  function handleClose() {
    setIsOpen(false);
    setIsSubmitting(false);
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    // Spam honeypot
    if (website.trim().length > 0) {
      setStatusTone("success");
      setStatusMessage("Feedback sent.");
      setName("");
      setIdea("");
      return;
    }

    setIsSubmitting(true);
    setStatusMessage(null);
    setStatusTone(null);

    try {
      const response = await fetch(FORM_ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          name: name.trim() || "Anonymous",
          message: idea.trim(),
          _subject: `Collfo Feedback from ${name.trim() || "Visitor"}`,
          _template: "table",
        }),
      });

      if (!response.ok) {
        throw new Error("Submission failed");
      }

      setStatusTone("success");
      setStatusMessage("Feedback sent. Thank you!");
      setName("");
      setIdea("");
      setWebsite("");
      
      setTimeout(() => {
        setIsOpen(false);
      }, 2500);
    } catch {
      setStatusTone("error");
      setStatusMessage("Could not send right now. Try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <>
      <button className="nav-action-btn" onClick={handleOpen}>
        Submit Feedback
      </button>

      {isOpen &&
        createPortal(
          <div className="feedback-overlay" role="presentation" onClick={handleClose}>
            <div
              className="feedback-modal"
              role="dialog"
              aria-modal="true"
              aria-labelledby="feedback-title"
              onClick={(event) => event.stopPropagation()}
            >
              <button
                aria-label="Close form"
                className="feedback-close-btn"
                type="button"
                onClick={handleClose}
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6L6 18"/><path d="M6 6l12 12"/></svg>
              </button>

              <h2 id="feedback-title" className="page-title feedback-title">
                Submit Feedback
              </h2>

              <form className="feedback-form" onSubmit={handleSubmit}>
                <div className="feedback-field" style={{ display: "none" }}>
                  <label htmlFor="website">Website</label>
                  <input
                    id="website"
                    type="text"
                    name="website"
                    value={website}
                    onChange={(e) => setWebsite(e.target.value)}
                    tabIndex={-1}
                    autoComplete="off"
                  />
                </div>

                <div className="feedback-field">
                  <label htmlFor="name" className="mono" style={{ textTransform: "uppercase" }}>Name, Email or X Handle</label>
                  <input
                    id="name"
                    name="name"
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    disabled={isSubmitting}
                    className="search-input"
                    autoComplete="off"
                    placeholder="Optional"
                  />
                </div>

                <div className="feedback-field">
                  <label htmlFor="idea" className="mono" style={{ textTransform: "uppercase" }}>Your Feedback</label>
                  <textarea
                    id="idea"
                    name="idea"
                    required
                    value={idea}
                    onChange={(e) => setIdea(e.target.value)}
                    disabled={isSubmitting}
                    placeholder="report bug, send suggestions or just say what you feel about collfo"
                    className="search-input feedback-textarea"
                    rows={5}
                  />
                </div>

                {statusMessage && (
                  <div className={`feedback-status feedback-status--${statusTone}`}>
                    {statusMessage}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="search-btn feedback-submit-btn"
                  style={{ marginTop: "8px" }}
                >
                  {isSubmitting ? "Sending..." : "Submit"}
                </button>
              </form>
            </div>
          </div>,
          document.body
        )}
    </>
  );
}
