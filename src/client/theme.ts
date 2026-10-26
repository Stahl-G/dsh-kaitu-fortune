export const readTheme = () => {
  const scheme = document.documentElement.style.colorScheme;
  if (scheme === "light" || scheme === "dark") return scheme;
  return document.body.hasAttribute("data-ds-dark-theme") ||
    (!scheme && matchMedia("(prefers-color-scheme: dark)").matches)
    ? "dark"
    : "light";
};
