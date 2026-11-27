// AtonotA Login product page (G-165). The page needs no session and loads as a separate chunk.
// Rules: existing capabilities go in the "What's available today?" section (`ready_title`). Unbuilt ones go in "Coming soon" (`soon_title`).
// No prices are shown (G-166). No requests to external URLs and no analytics scripts (G-134).
// Texts live in `messages.json`. Sizes come from the project's CSS variables.
import type { ReactNode } from 'react';

import { valueProps, type ValueProp } from './content';
import messages from './messages.json';
import './product.css';

const text = messages.tr;

function ValueList({ items }: { items: readonly ValueProp[] }) {
  return (
    <ul className="product-values">
      {items.map((item) => {
        const value = text.values[item.key];
        return (
          <li key={item.key} data-requirement={item.requirement}>
            <h3 className="product-value-title">{value.title}</h3>
            <p className="product-text">{value.body}</p>
          </li>
        );
      })}
    </ul>
  );
}

function Part({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section className="product-part" aria-labelledby={id}>
      <h2 id={id} className="product-heading">
        {title}
      </h2>
      {children}
    </section>
  );
}

export default function ProductPage() {
  const ready = valueProps.filter((item) => item.status === 'ready');
  const soon = valueProps.filter((item) => item.status === 'soon');
  return (
    <main className="product-page" aria-labelledby="product-title">
      <header className="product-part">
        <h1 id="product-title" className="product-heading">
          {text.title}
        </h1>
        <p className="product-text">{text.lead}</p>
        <p className="product-text">{text.lead_more}</p>
      </header>
      <Part id="product-ready" title={text.ready_title}>
        <ValueList items={ready} />
      </Part>
      <Part id="product-soon" title={text.soon_title}>
        <p className="product-text">{text.soon_intro}</p>
        <ValueList items={soon} />
      </Part>
      <Part id="product-pricing" title={text.pricing_title}>
        <p className="product-text">{text.pricing_body}</p>
        <p className="product-text">{text.pricing_more}</p>
      </Part>
      <Part id="product-license" title={text.license_title}>
        <p className="product-text">{text.license_product}</p>
        <p className="product-text">{text.license_keycloak}</p>
      </Part>
      <p className="product-text">
        {/* Panel home page: `/panel/` in production, `/` locally. */}
        <a href={import.meta.env.BASE_URL}>{text.cta}</a>
      </p>
    </main>
  );
}
