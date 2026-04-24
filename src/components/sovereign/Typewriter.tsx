"use client";

import { useEffect, useState } from "react";

type TypewriterProps = {
  text: string;
  speed?: number;
  onDone?: () => void;
};

export function Typewriter({ text, speed = 22, onDone }: TypewriterProps) {
  const [out, setOut] = useState("");

  useEffect(() => {
    let i = 0;
    setOut("");
    const id = setInterval(() => {
      i++;
      setOut(text.slice(0, i));
      if (i >= text.length) {
        clearInterval(id);
        onDone?.();
      }
    }, speed);
    return () => clearInterval(id);
  }, [text, speed, onDone]);

  return (
    <span>
      {out}
      <span
        style={{
          opacity: out.length < text.length ? 1 : 0,
          animation: "blink 0.8s steps(2) infinite",
        }}
      >
        ▊
      </span>
    </span>
  );
}

export default Typewriter;
