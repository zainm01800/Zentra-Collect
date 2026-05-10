import { Suspense } from "react";
import { BetaRequestConfirmation } from "@/components/beta-request-confirmation";

export default function BetaRequestPage() {
  return (
    <Suspense fallback={null}>
      <BetaRequestConfirmation />
    </Suspense>
  );
}
