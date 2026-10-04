import { lazy, Suspense, useState } from 'react';
import ErrorBoundary from './ErrorBoundary.jsx';

const createCatalogComponent = () => lazy(() => import('./CatalogTab.jsx'));

export default function CatalogPanel(props) {
  const [Catalog, setCatalog] = useState(createCatalogComponent);
  return <ErrorBoundary copy={props.copy.resourceStatus.renderError} onRetry={() => setCatalog(createCatalogComponent())}>
    <Suspense fallback={<section className="panel resource-state" role="status">{props.copy.catalog.loading}</section>}>
      <Catalog {...props} />
    </Suspense>
  </ErrorBoundary>;
}
