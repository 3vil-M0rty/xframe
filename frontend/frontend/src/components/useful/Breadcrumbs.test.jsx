import { describe, it, expect, beforeEach } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import Breadcrumbs from "./Breadcrumbs";
import { I18nProvider } from "../../context/i18nContext";
import { useI18n } from "../../hooks/useI18n";

// The provider reads the saved language from localStorage.
let savedLanguage = "fr";
globalThis.localStorage = { getItem: () => savedLanguage, setItem: () => {}, removeItem: () => {} };

const render = (props) => renderToStaticMarkup(
  <I18nProvider><MemoryRouter><Breadcrumbs {...props} /></MemoryRouter></I18nProvider>
);
const buttons = (html) => (html.match(/<button/g) || []).length;

describe("Breadcrumbs", () => {
  it("REGRESSION: an item with an href is a real link even when the page passes no onNavigate", () => {
    // Before: every click went through onNavigate only, which just 2 pages
    // passed — on every other page no breadcrumb (not even Home) did anything.
    const html = render({ items: [{ label: "RH", href: "/hr/employees" }, { label: "Absences" }] });
    expect(buttons(html)).toBe(2); // Home + "RH"
    expect(html).toContain(">RH</button>");
  });

  it("a section with no page and no handler is plain text, not a dead button", () => {
    const html = render({ items: [{ label: "Organisation" }, { label: "Entreprise" }] });
    expect(buttons(html)).toBe(1); // Home only
    expect(html).toContain(">Organisation</span>");
  });

  it("an in-page item (id, no href) is clickable when the page handles it", () => {
    const html = render({ items: [{ id: "users", label: "Utilisateurs" }, { id: "u1", label: "Sara" }], onNavigate: () => {} });
    expect(html).toContain(">Utilisateurs</button>");
  });

  it("the last item is the current page, never clickable", () => {
    const html = render({ items: [{ label: "Achats", href: "/purchasing/requests" }, { label: "Fournisseurs", href: "/x" }] });
    expect(html).toContain('aria-current="page">Fournisseurs</span>');
    expect(html).not.toContain(">Fournisseurs</button>");
  });
});

describe("translation fallback", () => {
  beforeEach(() => { savedLanguage = "fr"; });
  const Show = ({ k }) => { const { t } = useI18n(); return <span>{t(k)}</span>; };
  const show = (k) => renderToStaticMarkup(<I18nProvider><Show k={k} /></I18nProvider>);

  it("REGRESSION: a key missing in Arabic falls back to French instead of showing the raw key", () => {
    // purchasing.* exists in en/fr only
    savedLanguage = "ar";
    expect(show("purchasing.requests.title")).toContain("Demandes d&#x27;achat");
  });

  it("Spanish/Portuguese/German fall back to English", () => {
    savedLanguage = "de";
    expect(show("purchasing.requests.title")).toContain("Purchase requests");
  });

  it("an existing translation is still used as-is", () => {
    savedLanguage = "ar";
    expect(show("common.save")).toContain("حفظ");
  });

  it("a key missing everywhere still shows the key (visible in development)", () => {
    expect(show("does.not.exist")).toContain("does.not.exist");
  });
});
