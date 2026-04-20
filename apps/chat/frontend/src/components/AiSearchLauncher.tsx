import { useUIStore } from "@/stores/ui";
import { useTranslation } from "@/i18n";

export function AiSearchLauncher() {
  const { t } = useTranslation();
  const { aiSearchOpen, setAiSearchOpen } = useUIStore();

  return (
    <button
      type="button"
      onClick={() => setAiSearchOpen(true)}
      className={`inline-flex items-center gap-2 rounded-full border px-3 py-2 text-sm font-medium transition-colors ${
        aiSearchOpen
          ? "border-primary bg-primary/10 text-primary"
          : "border-slate-200 bg-white text-slate-700 hover:border-primary/30 hover:bg-primary/5 hover:text-primary"
      }`}
    >
      <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-primary/10 text-[11px] font-semibold text-primary">
        AI
      </span>
      {t("search.title")}
    </button>
  );
}
