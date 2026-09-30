"use client";

import Link from "next/link";
import { Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Lang } from "@/domain/types";
import { COPY } from "./copy";
import { useMee } from "./provider";

const LANG_ORDER: Lang[] = ["fr", "nl", "en"];

export function TopBar({ children }: { children?: React.ReactNode }) {
  const { lang, setLang, error } = useMee();
  const t = COPY[lang].brand;
  return (
    <header className="sticky top-0 z-40 border-b bg-background/85 backdrop-blur">
      <div className="mx-auto flex max-w-[1500px] flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 lg:px-6">
        <Link href="/" className="flex items-center gap-2">
          <span className="flex size-8 items-center justify-center rounded-xl bg-ink text-white"><Sparkles className="size-4" /></span>
          <span className="leading-tight">
            <span className="block text-sm font-semibold tracking-tight">Mee</span>
            <span className="block text-[11px] text-muted-foreground">{t.tagline}</span>
          </span>
        </Link>
        <span className="hidden rounded-full border px-2.5 py-1 text-[11px] font-medium text-muted-foreground sm:inline">{t.noLlm}</span>
        {error && <span className="rounded-full bg-destructive/10 px-2.5 py-1 text-[11px] text-destructive">{t.offline}</span>}
        <div className="ml-auto flex items-center gap-3">
          {children}
          <LangToggle value={lang} onChange={setLang} label={t.language} />
        </div>
      </div>
    </header>
  );
}

function LangToggle({ value, onChange, label }: { value: Lang; onChange: (l: Lang) => void; label: string }) {
  return (
    <div role="radiogroup" aria-label={label} className="flex rounded-full border bg-card p-0.5 text-xs font-medium">
      {LANG_ORDER.map((l) => (
        <button
          key={l}
          role="radio"
          aria-checked={value === l}
          onClick={() => onChange(l)}
          className={cn("rounded-full px-2.5 py-1 uppercase transition-colors", value === l ? "bg-ink text-white" : "text-muted-foreground hover:text-foreground")}
        >
          {l}
        </button>
      ))}
    </div>
  );
}

export function PhoneFrame({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("relative mx-auto h-[min(780px,calc(100dvh-12rem))] min-h-[600px] w-[380px] shrink-0 rounded-[48px] bg-ink p-2.5 shadow-2xl shadow-ink/30", className)}>
      <div className="absolute top-4 left-1/2 z-50 h-6 w-24 -translate-x-1/2 rounded-full bg-ink" />
      <div className="h-full overflow-hidden rounded-[38px] bg-background pt-8">{children}</div>
    </div>
  );
}
