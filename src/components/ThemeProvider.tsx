"use client";

import {
  createContext,
  useCallback,
  useContext,
  useState,
} from "react";

type Theme = "light" | "dark";

type Ctx = {
  theme: Theme;
  setTheme: (t: Theme) => void;
  toggle: () => void;
};

const ThemeContext = createContext<Ctx>({
  theme: "light",
  setTheme: () => {},
  toggle: () => {},
});

export function useTheme() {
  return useContext(ThemeContext);
}

function readInitialTheme(): Theme {
  if (typeof document === "undefined") return "light";
  const attr = document.documentElement.getAttribute("data-theme");
  return attr === "dark" ? "dark" : "light";
}

export default function ThemeProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [theme, setThemeState] = useState<Theme>(() => readInitialTheme());

  // Note: the previous useEffect re-read document.documentElement on every
  // theme change to defend against external DOM mutation. The React Compiler
  // (correctly) flagged the resulting setState-in-effect as a cascading
  // render trigger, and since `setTheme` below is the only writer to the
  // DOM attribute, the resync was a no-op in practice. Removed.

  const setTheme = useCallback((t: Theme) => {
    document.documentElement.setAttribute("data-theme", t);
    try {
      localStorage.setItem("sig-theme", t);
    } catch {}
    setThemeState(t);
  }, []);

  const toggle = useCallback(() => {
    setTheme(theme === "dark" ? "light" : "dark");
  }, [theme, setTheme]);

  return (
    <ThemeContext.Provider value={{ theme, setTheme, toggle }}>
      {children}
    </ThemeContext.Provider>
  );
}
