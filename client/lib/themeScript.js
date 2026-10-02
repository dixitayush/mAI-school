// Plain (server-safe) module: imported by the root layout, which is a server
// component and cannot read constants out of a "use client" module.
// Keep the storage key in sync with lib/theme.js.

/** Inline in <head>: sets the class before React hydrates, so there is no flash. */
export const THEME_INIT_SCRIPT = `(function(){try{var p=localStorage.getItem('theme');var d=p==='dark'||(p!=='light'&&window.matchMedia('(prefers-color-scheme: dark)').matches);var r=document.documentElement;if(d)r.classList.add('dark');r.style.colorScheme=d?'dark':'light';requestAnimationFrame(function(){requestAnimationFrame(function(){r.classList.add('theme-ready')})})}catch(e){}})();`;
