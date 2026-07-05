"use client";

import { useState, useEffect } from "react";

const D = {
  bg: "#0E1726",
  gold: "#F0B429",
  line: "#2A3B5E",
};

/**
 * Renders a hamburger button on mobile.
 * When clicked, adds/removes data-sidebar-open on <body> so the CSS
 * in globals.css can slide the sidebar in/out without JS touching the DOM.
 */
export function MobileSidebarToggle() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (open) {
      document.body.setAttribute("data-sidebar-open", "true");
    } else {
      document.body.removeAttribute("data-sidebar-open");
    }
    return () => document.body.removeAttribute("data-sidebar-open");
  }, [open]);

  // Close on route change
  useEffect(() => {
    const handler = () => setOpen(false);
    window.addEventListener("popstate", handler);
    return () => window.removeEventListener("popstate", handler);
  }, []);

  return (
    <>
      {/* Hamburger button — only visible on mobile */}
      <button
        className="mobile-menu-btn"
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? "Close menu" : "Open menu"}
        style={{
          display: "none", // shown via CSS on mobile
          position: "fixed",
          top: 12,
          left: 12,
          zIndex: 50,
          width: 40,
          height: 40,
          borderRadius: 10,
          border: `1px solid ${D.line}`,
          background: D.bg,
          cursor: "pointer",
          alignItems: "center",
          justifyContent: "center",
          flexDirection: "column",
          gap: 5,
          padding: 0,
        }}
      >
        <span style={{ display: "block", width: 18, height: 2, background: D.gold, borderRadius: 1, transition: "all 0.2s", transform: open ? "rotate(45deg) translate(5px,5px)" : "none" }} />
        <span style={{ display: "block", width: 18, height: 2, background: D.gold, borderRadius: 1, opacity: open ? 0 : 1, transition: "all 0.2s" }} />
        <span style={{ display: "block", width: 18, height: 2, background: D.gold, borderRadius: 1, transition: "all 0.2s", transform: open ? "rotate(-45deg) translate(5px,-5px)" : "none" }} />
      </button>

      {/* Backdrop — only visible on mobile when open */}
      {open && (
        <div
          className="mobile-backdrop"
          onClick={() => setOpen(false)}
          style={{
            display: "none", // shown via CSS on mobile
            position: "fixed",
            inset: 0,
            zIndex: 39,
            background: "rgba(0,0,0,0.5)",
          }}
        />
      )}
    </>
  );
}
