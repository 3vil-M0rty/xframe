import { useTranslatedField } from "../../hooks/useTranslatedField";

/**
 * Drop-in replacement for rendering a translatable field directly
 * (e.g. `{product.name}` -> `<TranslatedText doc={product} field="name" />`).
 * Renders as `as` (default "span"), passing through className/style/etc,
 * and always shows the text for the CURRENT UI language, updating
 * instantly on language switch with no network call.
 */
export default function TranslatedText({ doc, field, as: Tag = "span", ...rest }) {
  const text = useTranslatedField(doc, field);
  return <Tag {...rest}>{text}</Tag>;
}
