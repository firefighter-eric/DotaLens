import { useId, useRef } from 'react';
import { useModalDialog } from './useModalDialog.js';
import CatalogArtwork from './CatalogArtwork.jsx';
import CatalogIcon from './CatalogIcon.jsx';

function DetailContent({ item, kind, copy, headingId, inDialog = false, relatedItems, onSelect }) {
  const isHeroes = kind === 'heroes';
  const Heading = inDialog ? 'h3' : 'h2';
  const SectionHeading = inDialog ? 'h4' : 'h3';
  return <div className="library-detail-content">
    <CatalogArtwork key={item.key} item={item} kind={kind} eager />
    <div className="library-detail-name">
      <Heading id={headingId} aria-live="polite">{item.label}</Heading>
      {item.secondaryName && item.secondaryName !== item.label ? <p>{item.secondaryName}</p> : null}
      <div className="library-badges">
        <span className={`library-badge tone-${item.category}`}><span className="library-dot" aria-hidden="true" />{item.categoryLabel}</span>
        {isHeroes ? <span className="library-badge">{item.attackLabel}</span> : item.isRecipe ? <span className="library-badge">{copy.recipe}</span> : null}
      </div>
    </div>
    {isHeroes ? <>
      {item.roleLabels.length ? <div className="library-detail-section">
        <SectionHeading>{copy.heroRoles}</SectionHeading>
        <div className="library-roles">{item.roleLabels.map((role) => <span key={role}>{role}</span>)}</div>
      </div> : null}
      <div className="library-detail-section">
        <SectionHeading>{copy.basicStats}</SectionHeading>
        <dl className="library-attributes">
          {item.stats.map((stat) => <div key={stat.key} className={`tone-${stat.key}`}>
            <dt>{stat.label}</dt><dd>{stat.value ?? copy.heroDetails.emptyValue}</dd>
            <dd className="library-attribute-gain" title={copy.growthLabel}><span className="sr-only">{copy.growthLabel}: </span>{stat.gain == null ? copy.heroDetails.emptyValue : `${stat.gain >= 0 ? '+' : ''}${stat.gain.toFixed(1)}`}</dd>
          </div>)}
        </dl>
        <dl className="library-specs">
          <div><dt>{copy.heroDetails.attackRange}</dt><dd>{item.attackRange ?? copy.heroDetails.emptyValue}</dd></div>
          <div><dt>{copy.heroDetails.moveSpeed}</dt><dd>{item.moveSpeed ?? copy.heroDetails.emptyValue}</dd></div>
        </dl>
      </div>
      <dl className="library-identifiers"><div><dt>{copy.heroId}</dt><dd>{item.id ?? copy.heroDetails.emptyValue}</dd></div></dl>
    </> : <>
      <div className="library-detail-section">
        <SectionHeading>{copy.basicInfo}</SectionHeading>
        <dl className="library-specs">
          <div><dt>{copy.itemId}</dt><dd>{item.id ?? copy.heroDetails.emptyValue}</dd></div>
          <div><dt>{copy.internalName}</dt><dd className="library-internal-name">{item.internalName}</dd></div>
        </dl>
      </div>
      <p className="library-data-note">{copy.itemDataNote}</p>
      {relatedItems.length ? <div className="library-detail-section">
        <SectionHeading>{copy.relatedItems}</SectionHeading>
        <div className="library-related">{relatedItems.map((related) => <button type="button" key={related.key} title={related.label} aria-label={related.label} onClick={() => onSelect(related.key)}>
          <CatalogArtwork item={related} kind={kind} />
        </button>)}</div>
      </div> : null}
    </>}
  </div>;
}

function DetailNavigation({ copy, browser, compact = false }) {
  return <div className={`library-detail-nav ${compact ? 'is-compact' : ''}`}>
    <button type="button" className="library-button" aria-label={copy.previous} disabled={browser.selectedIndex === 0} onClick={() => browser.navigate(-1)}><CatalogIcon name="previous" />{compact ? null : copy.previous}</button>
    {!compact ? <span aria-live="polite">{copy.position({ current: browser.selectedIndex + 1, total: browser.filtered.length })}</span> : null}
    <button type="button" className="library-button" aria-label={copy.next} disabled={browser.selectedIndex >= browser.filtered.length - 1} onClick={() => browser.navigate(1)}>{compact ? null : copy.next}<CatalogIcon name="next" /></button>
  </div>;
}

function DetailDialog({ kind, copy, browser, relatedItems }) {
  const titleId = useId();
  const nameId = useId();
  const closeRef = useRef(null);
  const dialogRef = useModalDialog({ open: browser.detailOpen, onClose: () => browser.setDetailOpen(false), initialFocusRef: closeRef });
  return <dialog
    ref={dialogRef} className={`library-dialog library-dialog--${kind}`} aria-labelledby={titleId}
    onClick={(event) => { if (event.target === event.currentTarget) browser.setDetailOpen(false); }}
    onKeyDown={(event) => {
      if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') { event.preventDefault(); browser.navigate(event.key === 'ArrowLeft' ? -1 : 1); }
    }}
  >
    <header className="library-dialog-header"><h2 id={titleId}>{kind === 'heroes' ? copy.heroDetailTitle : copy.itemDetailTitle}</h2><button ref={closeRef} type="button" className="library-icon-button" aria-label={copy.closeDetails} onClick={() => browser.setDetailOpen(false)}><CatalogIcon name="close" /></button></header>
    <div className="library-dialog-body"><DetailContent item={browser.selectedItem} kind={kind} copy={copy} headingId={nameId} inDialog relatedItems={relatedItems} onSelect={browser.select} /></div>
    <footer className="library-dialog-footer"><DetailNavigation copy={copy} browser={browser} /></footer>
  </dialog>;
}

export default function CatalogDetail({ kind, copy, browser }) {
  const titleId = useId();
  const item = browser.selectedItem;
  if (!item) return null;
  const relatedItems = kind === 'items' ? browser.filtered.filter((entry) => entry.category === item.category && entry.key !== item.key && entry.isRecipe === item.isRecipe).slice(0, 6) : [];
  return <>
    <aside className="library-inspector" aria-labelledby={titleId}>
      <div className="library-inspector-toolbar"><DetailNavigation copy={copy} browser={browser} compact /><button type="button" className="library-button" onClick={() => browser.setDetailOpen(true)}><CatalogIcon name="expand" />{copy.viewDetails}</button></div>
      <DetailContent item={item} kind={kind} copy={copy} headingId={titleId} relatedItems={relatedItems} onSelect={browser.select} />
    </aside>
    <DetailDialog kind={kind} copy={copy} browser={browser} relatedItems={relatedItems} />
  </>;
}
