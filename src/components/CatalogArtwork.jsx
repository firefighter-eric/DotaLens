import { useState } from 'react';

export default function CatalogArtwork({ item, kind, eager = false }) {
  const [failed, setFailed] = useState(false);
  return <span className={`library-art library-art--${kind}`}>
    {item.icon && !failed
      ? <img src={item.icon} alt="" loading={eager ? 'eager' : 'lazy'} decoding="async" onError={() => setFailed(true)} />
      : <span className="library-art__fallback" aria-hidden="true">{item.fallback}</span>}
  </span>;
}
