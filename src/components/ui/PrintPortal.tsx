"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

// Renders its children into a container that is a direct child of <body>.
//
// Why this exists: hiding the dashboard with `visibility: hidden` leaves every
// element still occupying its full height, so a label print came out as ~22
// blank sheets. Printing from a body-level container instead lets the print CSS
// `display: none` everything else, which collapses the document to just the
// label -- exactly one sticker, nothing else.
export function PrintPortal({ children }: { children: React.ReactNode }) {
  const [host, setHost] = useState<HTMLElement | null>(null);

  useEffect(() => {
    const el = document.createElement("div");
    el.id = "print-portal";
    document.body.appendChild(el);
    setHost(el);
    return () => {
      el.remove();
    };
  }, []);

  if (!host) return null;
  return createPortal(children, host);
}
