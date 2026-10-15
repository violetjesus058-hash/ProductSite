import { ArrowRight, LayoutGrid, Table2 } from "lucide-react";
import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { trackEvent, trackOnce } from "@/lib/analytics";
import "../pages/spreadsheet.css";

const ENTRY_CHOICE_KEY = "rivora-spreadsheet-entry-choice-v3";
const entryPreviewBase = `${import.meta.env.BASE_URL.replace(/\/$/, "")}/entry-previews`;

type EntryChoice = "product-site" | "spreadsheet";

function readChoice(sourcePath: string) {
  try { return typeof window === "undefined" ? null : window.localStorage.getItem(`${ENTRY_CHOICE_KEY}:${sourcePath}`); }
  catch { return null; }
}

export default function CatalogEntryChooser({ sourcePath, onChoose }: { sourcePath: string; onChoose: (choice: EntryChoice) => void }) {
  const [open, setOpen] = useState(() => !readChoice(sourcePath));
  if (!open) return null;

  if (typeof window !== "undefined") {
    trackOnce("catalog_entry_chooser_view", `entry-chooser-v3:${sourcePath}`, {
      page_type: "entry_chooser",
      available_entries: "product-site,spreadsheet",
      source_path: sourcePath,
    });
  }

  const choose = (choice: EntryChoice) => {
    trackEvent("catalog_entry_choice", {
      page_type: "entry_chooser",
      choice,
      destination_path: choice === "product-site" ? "/" : "/spreadsheet",
      source_path: sourcePath,
      choice_source: "modal",
    });
    try { window.localStorage.setItem(`${ENTRY_CHOICE_KEY}:${sourcePath}`, choice); } catch { /* Continue if storage is unavailable. */ }
    setOpen(false);
    onChoose(choice);
  };

  return <Dialog open={open}>
    <DialogContent className="catalog-entry-dialog" showCloseButton={false} onEscapeKeyDown={(event) => event.preventDefault()} onPointerDownOutside={(event) => event.preventDefault()}>
      <p className="catalog-entry-kicker">RIVORA · PRODUCT CATALOG</p>
      <DialogTitle className="catalog-entry-title">Choose how you want to browse</DialogTitle>
      <DialogDescription className="catalog-entry-description">Select a catalog experience. We’ll remember your choice in this browser.</DialogDescription>
      <div className="catalog-entry-options" role="group" aria-label="Choose a catalog experience">
        <button className="catalog-entry-card" type="button" onClick={() => choose("product-site")}>
          <img className="catalog-entry-preview" src={`${entryPreviewBase}/product-gallery.svg`} alt="Preview of the RIVORA product gallery with category navigation and product cards" />
          <span className="catalog-entry-card-icon"><LayoutGrid size={22} aria-hidden="true" /></span>
          <strong>Product-site style</strong>
          <span className="catalog-entry-card-description">Browse product imagery and open full product details.</span>
          <span className="catalog-entry-action">Explore gallery <ArrowRight size={15} aria-hidden="true" /></span>
        </button>
        <button className="catalog-entry-card is-current" type="button" onClick={() => choose("spreadsheet")}>
          <img className="catalog-entry-preview" src={`${entryPreviewBase}/spreadsheet-table.svg`} alt="Preview of the RIVORA spreadsheet catalog with category tiles and comparison rows" />
          <span className="catalog-entry-card-icon"><Table2 size={22} aria-hidden="true" /></span>
          <strong>Spreadsheet style</strong>
          <span className="catalog-entry-card-description">Compare styles, prices and platforms in a structured table.</span>
          <span className="catalog-entry-action">Continue with table <ArrowRight size={15} aria-hidden="true" /></span>
        </button>
      </div>
      <p className="catalog-entry-note">You can still switch between the gallery and table from the page navigation.</p>
    </DialogContent>
  </Dialog>;
}
