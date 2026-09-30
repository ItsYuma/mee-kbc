"use client";

import Link from "next/link";
import { Check, ExternalLink } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import type { MeeState } from "@/domain/types";
import { AgentDesk } from "./agent-desk";
import { PhoneFrame, TopBar } from "./chrome";
import { CustomerApp } from "./customer-app";
import { useMee } from "./provider";
import { Simulator } from "./simulator";

const STEPS: { label: string; done: (s: MeeState) => boolean }[] = [
  { label: "Fire an event", done: (s) => s.signals.length > 0 },
  { label: "Situation appears", done: (s) => s.situations.length > 0 },
  { label: "Hear the approved line", done: (s) => s.timeline.some((e) => e.text.en.startsWith("Voice line")) },
  { label: "Call support, same words", done: (s) => s.timeline.some((e) => e.text.en.startsWith("Customer called")) },
  { label: "Why am I seeing this?", done: (s) => s.timeline.some((e) => e.text.en.includes("Why am I seeing this")) },
  { label: "Pause Mee", done: (s) => s.timeline.some((e) => e.kind === "privacy" && e.text.en.includes("paused")) },
];

export function Stage() {
  const { state } = useMee();
  return (
    <>
      <TopBar>
        <nav className="hidden items-center gap-3 text-xs text-muted-foreground md:flex">
          <Link href="/customer" target="_blank" className="flex items-center gap-1 hover:text-foreground">Customer <ExternalLink className="size-3" /></Link>
          <Link href="/agent" target="_blank" className="flex items-center gap-1 hover:text-foreground">Agent <ExternalLink className="size-3" /></Link>
        </nav>
      </TopBar>

      <div className="mx-auto w-full max-w-[1500px] px-4 py-4 lg:px-6">
        <ol className="mb-5 flex gap-2 overflow-x-auto pb-1 text-xs">
          {STEPS.map((step, i) => {
            const done = !!state && step.done(state);
            return (
              <li key={step.label} className={cn("flex shrink-0 items-center gap-2 rounded-full border px-3 py-1.5", done ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "bg-card text-muted-foreground")}>
                <span className={cn("flex size-5 items-center justify-center rounded-full text-[10px] font-semibold", done ? "bg-emerald-600 text-white" : "bg-muted")}>
                  {done ? <Check className="size-3" /> : i + 1}
                </span>
                {step.label}
              </li>
            );
          })}
        </ol>

        <div className="hidden gap-6 xl:grid xl:grid-cols-[280px_380px_minmax(0,1fr)]">
          <Column title="Simulator" subtitle="Mock event stream">
            <Simulator />
          </Column>
          <Column title="Customer · KBC-style mobile" subtitle="Lotte Peeters, Gent">
            <PhoneFrame><CustomerApp /></PhoneFrame>
          </Column>
          <Column title="Agent desk" subtitle="Contact center, same situation bus">
            <AgentDesk />
          </Column>
        </div>

        <Tabs defaultValue="customer" className="xl:hidden">
          <TabsList className="w-full">
            <TabsTrigger value="simulator">Simulator</TabsTrigger>
            <TabsTrigger value="customer">Customer</TabsTrigger>
            <TabsTrigger value="agent">Agent</TabsTrigger>
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

function Column({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <section className="flex min-w-0 flex-col gap-3">
      <div>
        <h2 className="text-sm font-semibold">{title}</h2>
        <p className="text-xs text-muted-foreground">{subtitle}</p>
      </div>
      {children}
    </section>
  );
}
