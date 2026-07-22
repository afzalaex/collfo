"use client";

import { useEffect, useState } from "react";
import Image from "next/image";

export function IntroAnimation({ initialShow }: { initialShow: boolean }) {
  const [show, setShow] = useState(initialShow);
  const [isFadingOut, setIsFadingOut] = useState(false);

  useEffect(() => {
    // If the server determined they haven't seen it, play the animation
    if (initialShow) {
      // Start the fade out sequence after 2 seconds
      const fadeTimer = setTimeout(() => {
        setIsFadingOut(true);
      }, 2000);
      
      // Completely unmount after 2.5 seconds (after fade finishes)
      const unmountTimer = setTimeout(() => {
        setShow(false);
        // Set a session cookie so the server knows they've seen it for next time
        document.cookie = "collfoIntroSeen=true; path=/";
      }, 2500);
      
      return () => {
        clearTimeout(fadeTimer);
        clearTimeout(unmountTimer);
      };
    }
  }, [initialShow]);

  if (!show) return null;

  return (
    <div className={`intro-overlay ${isFadingOut ? "fade-out" : ""}`}>
      <div className="intro-logo-group">
        <div className="intro-logo-monogram">
          <img src="/assets/monogram-left.svg" alt="" className="intro-part-left" />
          <img src="/assets/monogram-right.svg" alt="" className="intro-part-right" />
        </div>
        <div className="intro-logo-full-wrapper">
          <img src="/assets/full-logo.svg" alt="Collfo" className="intro-logo-full-img" />
        </div>
      </div>
    </div>
  );
}
