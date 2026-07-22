"use client";

import { useEffect, useState } from "react";
import Image from "next/image";

export function IntroAnimation() {
  const [show, setShow] = useState(false);
  const [isFadingOut, setIsFadingOut] = useState(false);

  useEffect(() => {
    // Check if the user has already seen the intro this session
    const hasSeenIntro = sessionStorage.getItem("collfoIntroSeen");
    
    if (!hasSeenIntro) {
      setShow(true);
      
      // Start the fade out sequence after 2 seconds (allows animation to play)
      const fadeTimer = setTimeout(() => {
        setIsFadingOut(true);
      }, 2000);
      
      // Completely unmount after 2.5 seconds (after fade finishes)
      const unmountTimer = setTimeout(() => {
        setShow(false);
        sessionStorage.setItem("collfoIntroSeen", "true");
      }, 2500);
      
      return () => {
        clearTimeout(fadeTimer);
        clearTimeout(unmountTimer);
      };
    }
  }, []);

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
