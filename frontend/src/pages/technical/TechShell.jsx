import Breadcrumbs from "../../components/useful/Breadcrumbs";
import CustomSelect from "../../components/useful/CustomSelect";
import { useI18n } from "../../hooks/useI18n";
import { useCompanyPicker } from "../production/prodShared";
import purch from "../purchasing/Purchasing.module.css";

/**
 * Common frame of the TECHNIQUE pages (catalogue, glass compositions,
 * technical data of articles, finishes, calculation settings): title,
 * company picker, then the page body for the chosen company.
 */
export default function TechShell({ icon: Icon, title, subtitle, actions, children }) {
  const { t } = useI18n();
  const { companyId, setCompanyId, options: companyOptions } = useCompanyPicker();
  return (
    <div className="pageShell">
      <Breadcrumbs items={[{ label: t("sidebar.technical"), href: "/technical/catalog" }, { label: title }]} />
      <div className="pageHeader">
        <div>
          <div className="pageTitleRow">{Icon && <Icon size={20} />}<h1>{title}</h1></div>
          {subtitle && <p className="pageSubtitle">{subtitle}</p>}
        </div>
        {actions && <div className="pageHeaderActions">{actions}</div>}
      </div>
      <div className={purch.toolbar}>
        <div className="filterGroup">
          <label>{t("employees.toolbar.company")}</label>
          <CustomSelect value={companyId} onSelect={setCompanyId} options={companyOptions} />
        </div>
      </div>
      {companyId && children(companyId)}
    </div>
  );
}
