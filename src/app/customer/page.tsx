import { CustomerApp } from "@/components/mee/customer-app";
import { PhoneFrame } from "@/components/mee/chrome";
import { MeeProvider } from "@/components/mee/provider";

export default function CustomerPage() {
  return (
    <MeeProvider>
      <div className="flex min-h-dvh items-center justify-center bg-muted/40">
        <PhoneFrame className="max-sm:h-dvh max-sm:w-full max-sm:rounded-none max-sm:p-0 max-sm:shadow-none [&>div:last-child]:max-sm:rounded-none [&>div:last-child]:max-sm:pt-0 [&>div:first-child]:max-sm:hidden">
          <CustomerApp />
        </PhoneFrame>
      </div>
    </MeeProvider>
  );
}
