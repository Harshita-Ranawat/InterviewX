import { useTheme } from "../context/ThemeContext.jsx";

export default function ThemeToggle({ className = "" }) {
  const { isDark, toggleTheme } = useTheme();
  return (
    <button
      type="button"
      onClick={toggleTheme}
      title={isDark ? "Switch to light mode" : "Switch to dark mode"}
      className={`rounded-lg border border-slate-300/80 dark:border-white/15 px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 bg-white/80 dark:bg-white/5 hover:bg-slate-100 dark:hover:bg-white/10 ${className}`}
    >
      {isDark ? "Light mode" : "Dark mode"}
    </button>
  );
}
