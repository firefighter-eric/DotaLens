const paths = {
  search: <><circle cx="10.5" cy="10.5" r="6.5" /><path d="m16 16 4.5 4.5" /></>,
  close: <path d="m6 6 12 12M6 18 18 6" />,
  previous: <path d="m14 5-7 7 7 7" />,
  next: <path d="m10 5 7 7-7 7" />,
  expand: <><path d="M14 4h6v6m0-6-9 9" /><path d="M10 4H5a1 1 0 0 0-1 1v14a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-5" /></>,
  reset: <><path d="M4 10a8 8 0 1 1 1 8M4 4v6h6" /></>,
};

export default function CatalogIcon({ name, className = '' }) {
  return <svg className={`library-icon ${className}`} width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>;
}
