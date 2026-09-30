"use client";

import Link from "next/link";
import { Check, ExternalLink } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import type { MeeState } from "@/domain/types";
import { AgentDesk } from "./agent-desk";
import { PhoneFrame, TopBar } from "./chrome";
import { COPY, type Copy } from "./copy";
import { CustomerApp } from "./customer-app";
import { useMee } from "./provider";
import { Simulator } from "./simulator";

const STEPS: { key: keyof Copy["stage"]["steps"]; done: (s: MeeState) => boolean }[] = [
  { key: "event", done: (s) => s.signals.length > 0 },
  { key: "situation", done: (s) => s.situations.length > 0 },
  { key: "meeSpeaks", done: (s) => !!s.call || s.timeline.some((e) => e.text.en.startsWith("Voice line")) },
  { key: "customerReplies", done: (s) => !!s.call?.turns.some((t) => t.speaker === "customer") },
  { key: "handoff", done: (s) => s.call?.handedOffAt !== undefined },
  { key: "why", done: (s) => s.timeline.some((e) => e.text.en.includes("Why am I seeing this")) },
  { key: "pause", done: (s) => s.timeline.some((e) => e.kind === "privacy" && e.text.en.includes("paused")) },
];

export function Stage() {
  const { state, lang } = useMee();
  const t = COPY[lang].stage;
  return (
    <>
      <TopBar>
        <nav className="hidden items-center gap-3 text-xs text-muted-foreground md:flex">
          <Link href="/customer" target="_blank" className="flex items-center gap-1 hover:text-foreground">{t.openCustomer} <ExternalLink className="size-3" /></Link>
          <Link href="/agent" target="_blank" className="flex items-center gap-1 hover:text-foreground">{t.openAgent} <ExternalLink className="size-3" /></Link>
        </nav>
      </TopBar>

      <div className="mx-auto w-full max-w-[1500px] px-4 py-4 lg:px-6">
        <ol className="mb-5 flex gap-2 overflow-x-auto pb-1 text-xs">
          {STEPS.map((step, i) => {
            const done = !!state && step.done(state);
            return (
              <li key={step.key} className={cn("flex shrink-0 items-center gap-2 rounded-full border px-3 py-1.5", done ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "bg-card text-muted-foreground")}>
                <span className={cn("flex size-5 items-center justify-center rounded-full text-[10px] font-semibold", done ? "bg-emerald-600 text-white" : "bg-muted")}>
                  {done ? <Check className="size-3" /> : i + 1}
                </span>
                {t.steps[step.key]}
              </li>
            );
          })}
        </ol>

        <div className="hidden gap-6 xl:grid xl:h-[calc(100dvh-8.5rem)] xl:min-h-[660px] xl:grid-cols-[280px_380px_minmax(0,1fr)]">
          <Column title={t.simulator} subtitle={t.simulatorSub} scroll>
            <Simulator />
          </Column>
          <Column title={t.customer} subtitle={t.customerSub}>
            <PhoneFrame><CustomerApp /></PhoneFrame>
          </Column>
          <Column title={t.agent} subtitle={t.agentSub} scroll>
            <AgentDesk />
          </Column>
        </div>

        <Tabs defaultValue="customer" className="xl:hidden">
          <TabsList className="w-full">
            <TabsTrigger value="simulator">{t.simulator}</TabsTrigger>
            <TabsTrigger value="customer">{t.openCustomer}</TabsTrigger>
            <TabsTrigger value="agent">{t.openAgent}</TabsTrigger>
          </TabsList>
          <TabsContent value="simulator" className="pt-4"><Simulator /></TabsContent>
          <TabsContent value="customer" className="pt-4">
            <div className="mx-auto h-[calc(100dvh-190px)] min-h-[560px] max-w-md overflow-hidden rounded-3xl border shadow-sm"><CustomerApp /></div>
          </TabsContent>
          <TabsContent value="agent" className="pt-4"><AgentDesk /></TabsContent>
        </Tabs>
      </div>
    </>
  );
}

function Column({ title, subtitle, scroll, children }: { title: string; subtitle: string; scroll?: boolean; children: React.ReactNode }) {
  return (
    <section className="flex min-h-0 min-w-0 flex-col gap-3">
      <div>
        <h2 className="text-sm font-semibold">{title}</h2>
        <p className="text-xs text-muted-foreground">{subtitle}</p>
      </div>
      <div className={cn("min-h-0 flex-1", scroll && "-mr-2 overflow-y-auto pr-2 pb-4")}>{children}</div>
    </section>
  );
}
