// components/dispatch/SendControllerButton.tsx
"use client";

import * as React from "react";
import { sendControllerRequestAction } from "@/app/actions/send-controller-request";
import { Button } from "@/components/ui/Button";

type ControllerKey = "truecaller" | "naukri" | "olx" | "foundit" | "shine" | "timesjobs" | "generic";
type Locale = "en" | "hi";

export function SendControllerButton({
  controllerKey,
  controllerName,
  subject,
  locale = "en",
  onSuccess,
  onError,
  children,
}: {
  controllerKey: ControllerKey;
  controllerName: string;
  subject: { name?: string | null; email?: string | null; phone?: string | null };
  locale?: Locale;
  onSuccess?: (info: { channel: string; providerId?: string | null; note?: string | null }) => void;
  onError?: (err: { error: string; hint?: string | null }) => void;
  children?: React.ReactNode;
}) {
  const [pending, startTransition] = React.useTransition();

  return (
    <Button
      type="button"
      disabled={pending}
      onClick={() => {
        startTransition(async () => {
          const res = await sendControllerRequestAction({
            controllerKey,
            controllerName,
            subject,
            locale,
          });

          if (res.ok) {
            onSuccess?.({ channel: res.channel, providerId: res.providerId, note: res.note });
          } else {
            onError?.({ error: res.error, hint: res.hint ?? undefined });
          }
        });
      }}
    >
      {pending ? "Sending…" : children ?? "Send request"}
    </Button>
  );
}
