// Capture system appearance once; scrolling owns the subsequent palette inversion.
const startingTheme = window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
document.documentElement.dataset.theme = startingTheme;
document.documentElement.dataset.startTheme = startingTheme;
document.querySelector('meta[name="theme-color"]')?.setAttribute('content', startingTheme === 'light' ? '#ffffff' : '#0b0b0c');
