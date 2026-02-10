// Inline script to prevent flash of unstyled content (FOUC)
// This runs before React hydration to immediately apply the correct theme

const themeScript = `
(function() {
  try {
    var theme = localStorage.getItem('theme-preference');
    var isDark = false;

    if (theme === 'dark') {
      isDark = true;
    } else if (theme === 'light') {
      isDark = false;
    } else {
      // System preference or no preference set
      isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    }

    if (isDark) {
      document.documentElement.classList.add('dark');
    }
  } catch (e) {}
})();
`;

export function ThemeScript() {
  return (
    <script
      dangerouslySetInnerHTML={{ __html: themeScript }}
      suppressHydrationWarning
    />
  );
}
