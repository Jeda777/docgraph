// Applies the stored theme before the app renders, so dark mode doesn't flash white. A file
// instead of an inline script, which the Content-Security-Policy doesn't allow. The block keeps
// the variables out of the page's global scope.
{
  let storedTheme
  try {
    storedTheme = JSON.parse(localStorage.getItem('ui-store'))?.state?.theme
  } catch {}
  const isDark = storedTheme
    ? storedTheme === 'dark'
    : window.matchMedia('(prefers-color-scheme: dark)').matches
  document.documentElement.classList.toggle('dark', isDark)
}
