import { MeeProvider } from "@/components/mee/provider";
import { Stage } from "@/components/mee/stage";

export default function Page() {
  return (
    <MeeProvider>
      <Stage />
    </MeeProvider>
  );
}
