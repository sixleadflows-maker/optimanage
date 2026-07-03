"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";

type Stage = "idle" | "exiting" | "entering";

export function PageTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [displayChildren, setDisplayChildren] = useState(children);
  const [displayPathname, setDisplayPathname] = useState(pathname);
  const [stage, setStage] = useState<Stage>("idle");
  const latestChildren = useRef(children);
  latestChildren.current = children;

  useEffect(() => {
    if (pathname !== displayPathname) {
      setStage("exiting");
    }
  }, [pathname, displayPathname]);

  useEffect(() => {
    if (stage === "idle") setDisplayChildren(children);
  }, [children, stage]);

  const handleAnimationEnd = () => {
    if (stage === "exiting") {
      setDisplayChildren(latestChildren.current);
      setDisplayPathname(pathname);
      setStage("entering");
    } else if (stage === "entering") {
      setStage("idle");
    }
  };

  return (
    <div
      onAnimationEnd={handleAnimationEnd}
      className={stage === "exiting" ? "page-exit" : stage === "entering" ? "page-enter" : ""}
    >
      {displayChildren}
    </div>
  );
}
