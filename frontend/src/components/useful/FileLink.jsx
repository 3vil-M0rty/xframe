import { useState } from "react";
import { Paperclip, Loader2 } from "lucide-react";
import { useI18n } from "../../hooks/useI18n";
import { getFileLink } from "../../services/fileService";

/**
 * Opens a stored document in a new tab. Documents are private: on
 * click, the app asks the backend for a link valid a few minutes and
 * opens it — nothing permanent ever sits in the page.
 *
 *   <FileLink kind="order-invoice" id={order._id} sub={invoice._id} file={invoice.file} className=... />
 *
 * Renders nothing when there's no file.
 */
export default function FileLink({ kind, id, sub, file, className, children, iconSize = 13, showIcon = true }) {
  const { t } = useI18n();
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  if (!file || (!file.url && !file.publicId)) return null;

  const handleClick = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (busy) return;
    // Opened synchronously on the click so the browser doesn't treat
    // it as a pop-up; filled in once the link arrives.
    const win = window.open("", "_blank");
    setBusy(true);
    setFailed(false);
    try {
      const { url } = await getFileLink({ kind, id, sub });
      if (win) {
        win.opener = null;
        win.location.href = url;
      } else {
        window.location.assign(url);
      }
    } catch {
      if (win) win.close();
      setFailed(true);
    } finally {
      setBusy(false);
    }
  };

  return (
    <a href="#" className={className} onClick={handleClick} title={failed ? t("files.openFailed") : t("files.open")}>
      {showIcon && (busy ? <Loader2 size={iconSize} className="spin" /> : <Paperclip size={iconSize} />)}{" "}
      {failed ? t("files.openFailed") : children || file.originalName || t("files.open")}
    </a>
  );
}
