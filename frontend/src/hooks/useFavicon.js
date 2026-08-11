import { useEffect } from 'react';

export default function useFavicon(iconFilename, pageTitle) {
  useEffect(() => {
    if (pageTitle) {
      document.title = pageTitle;
    }
    if (iconFilename) {
      let link = document.querySelector("link[rel~='icon']");
      if (!link) {
        link = document.createElement('link');
        link.rel = 'icon';
        document.getElementsByTagName('head')[0].appendChild(link);
      }
      link.type = 'image/png';
      link.href = `/${iconFilename}`;
    }
  }, [iconFilename, pageTitle]);
}
