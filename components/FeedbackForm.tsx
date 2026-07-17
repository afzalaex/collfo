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
      <button
        type="button"
        className="layout-action-link"
        onClick={handleOpen}
      >
        Submit Feedback
      </button>

      {isOpen &&
        createPortal(
          <div className="contact-overlay" role="presentation" onClick={handleClose}>
            <div
              className="contact-modal"
              role="dialog"
              aria-modal="true"
              aria-labelledby="homepage-contact-title"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="contact-modal-header">
                <div className="contact-modal-copy">
                  <p id="homepage-contact-title" className="mail-box-title">
                    LET ME HELP YOU IMPROVE COLLFO
                  </p>
                </div>
                <button
                  className="contact-close"
                  type="button"
                  aria-label="Close form"
                  onClick={handleClose}
                />
              </div>

              <form className="mail-box" onSubmit={handleSubmit}>
                <label className="honeypot-field" aria-hidden="true" tabIndex={-1}>
                  <span className="field-label">Website</span>
                  <input
                    className="field-input"
                    type="text"
                    name="website"
                    value={website}
                    onChange={(e) => setWebsite(e.target.value)}
                    autoComplete="off"
                    tabIndex={-1}
                  />
                </label>

                <div className="field-grid">
                  <label className="field" style={{ gridColumn: "1 / -1" }}>
                    <span className="field-label">Name, Email or X Handle (optional)</span>
                    <input
                      className="field-input"
                      type="text"
                      name="name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      autoComplete="off"
                    />
                  </label>
                </div>

                <label className="field">
                  <span className="field-label">Your Feedback</span>
                  <textarea
                    className="field-input field-textarea"
                    name="idea"
                    value={idea}
                    onChange={(e) => setIdea(e.target.value)}
                    placeholder="Report bug, send suggestions or just say what you feel about collfo"
                    required
                  />
                </label>

                <div className="mail-box-footer">
                  <button className="mail-box-button" type="submit" disabled={isSubmitting}>
                    {isSubmitting ? "Sending..." : "Submit"}
                  </button>
                  {statusMessage && (
                    <p
                      className={`form-status ${
                        statusTone === "error" ? "form-status-error" : "form-status-success"
                      }`}
                      role={statusTone === "error" ? "alert" : "status"}
                    >
                      {statusMessage}
                    </p>
                  )}
                </div>
              </form>
            </div>
          </div>,
          document.body
        )}
    </>
  );
}
