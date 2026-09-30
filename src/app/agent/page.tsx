import { AgentDesk } from "@/components/mee/agent-desk";
import { TopBar } from "@/components/mee/chrome";
import { MeeProvider } from "@/components/mee/provider";

export default function AgentPage() {
  return (
    <MeeProvider>
      <TopBar />
      <main className="mx-auto w-full max-w-[1200px] px-4 py-5 lg:px-6"><AgentDesk /></main>
    </MeeProvider>
  );
}
