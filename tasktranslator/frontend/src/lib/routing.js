const KNOWN_TRANSLATOR_BASES = ['/Translator', '/translator'];

export function getTranslatorBasePath(pathname = window.location.pathname) {
  const normalizedPath = pathname || '/';
  return KNOWN_TRANSLATOR_BASES.find((basePath) => (
    normalizedPath === basePath || normalizedPath.startsWith(`${basePath}/`)
  )) || '';
}

export function isAdminPath(pathname = window.location.pathname) {
  const normalizedPath = (pathname || '/').replace(/\/+$/, '') || '/';

  if (normalizedPath === '/admin' || normalizedPath.startsWith('/admin/')) {
    return true;
  }

  return KNOWN_TRANSLATOR_BASES.some((basePath) => (
    normalizedPath === `${basePath}/admin` || normalizedPath.startsWith(`${basePath}/admin/`)
  ));
}

export function getAdminPath(pathname = window.location.pathname) {
  const basePath = getTranslatorBasePath(pathname);
  return basePath ? `${basePath}/admin` : '/admin';
}

export function getAppHomePath(pathname = window.location.pathname) {
  const basePath = getTranslatorBasePath(pathname);
  return basePath ? `${basePath}/` : '/';
}
