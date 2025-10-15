// app/ops/dispatch/page.tsx
"use client";

import * as React from "react";
import { sendOpsDispatchAction } from "./actions";
import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardTitle, CardSubtitle } from "@/components/ui/Card";
import EmptyState from "@/components/ui/EmptyState";
import { FormField } from "@/components/ui/FormField";

type ControllerKey = "truecaller" | "naukri" | "olx" | "foundit" | "shine" | "timesjobs" | "generic";

export default function OpsDispatchPage() {
  const [controllerKey, setControllerKey] = React.useState<ControllerKey>("truecaller");
  const [controllerName, setControllerName] = React.useState("Truecaller");
  const [name, setName] = React.useState("Rahul Sharma");
  const [email, setEmail] = React.useState("rahul@example.com");
  const [phone, setPhone] = React.useState("+91 98xxxx1234");
  const [locale, setLocale] = React.useState<"en" | "hi">("en");

  const [pending, startTransition] = React.useTransition();
  const [result, setResult] = React.useState<null | { ok: boolean; message: string }>(null);

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setResult(null);

    startTransition(async () => {
      const res = await sendOpsDispatchAction({
        controllerKey,
        controllerName,
        subject: { name, email, phone },
        locale,
      });

      if (res.ok) {
        setResult({ ok: true, message: `Sent via ${res.channel}${res.providerId ? ` (id ${res.providerId})` : ""}` });
      } else {
        setResult({ ok: false, message: `Failed: ${res.error}${res.hint ? ` [${res.hint}]` : ""}` });
      }
    });
  }

  return (
    <div className="container" style={{ paddingTop: 24, paddingBottom: 24 }}>
      <Card>
        <CardBody>
          <CardTitle>Ops · Dispatch Test</CardTitle>
          <CardSubtitle>Send a site-specific request using the unified dispatcher.</CardSubtitle>

          <form onSubmit={onSubmit} style={{ marginTop: 16, display: "grid", gap: 12 }}>
            <div className="row">
              <div className="col">
                <FormField label="Controller (key)">
                  <select
                    className="input"
                    value={controllerKey}
                    onChange={(e) => {
                      const k = e.target.value as ControllerKey;
                      setControllerKey(k);
                      // Friendly auto-name
                      const nameMap: Record<ControllerKey, string> = {
                        truecaller: "Truecaller",
                        naukri: "Naukri",
                        olx: "OLX",
                        foundit: "Foundit",
                        shine: "Shine",
                        timesjobs: "TimesJobs",
                        generic: "Generic",
                      };
                      setControllerName(nameMap[k] || "Controller");
                    }}
                  >
                    <option value="truecaller">truecaller</option>
                    <option value="naukri">naukri</option>
                    <option value="olx">olx</option>
                    <option value="foundit">foundit</option>
                    <option value="shine">shine</option>
                    <option value="timesjobs">timesjobs</option>
                    <option value="generic">generic</option>
                  </select>
                </FormField>
              </div>
              <div className="col">
                <FormField label="Controller (display name)">
                  <input className="input" value={controllerName} onChange={(e) => setControllerName(e.target.value)} />
                </FormField>
              </div>
              <div style={{ width: 160 }}>
                <FormField label="Locale">
                  <select className="input" value={locale} onChange={(e) => setLocale(e.target.value as any)}>
                    <option value="en">English (en)</option>
                    <option value="hi">Hindi (hi)</option>
                  </select>
                </FormField>
              </div>
            </div>

            <div className="row">
              <div className="col">
                <FormField label="Name">
                  <input className="input" value={name} onChange={(e) => setName(e.target.value)} />
                </FormField>
              </div>
              <div className="col">
                <FormField label="Email">
                  <input className="input" value={email} onChange={(e) => setEmail(e.target.value)} />
                </FormField>
              </div>
              <div className="col">
                <FormField label="Phone">
                  <input className="input" value={phone} onChange={(e) => setPhone(e.target.value)} />
                </FormField>
              </div>
            </div>

            <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
              <Button type="submit" disabled={pending}>
                {pending ? "Sending…" : "Send request"}
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={pending}
                onClick={() => {
                  setName("Rahul Sharma");
                  setEmail("rahul@example.com");
                  setPhone("+91 98xxxx1234");
                }}
              >
                Reset sample
              </Button>
            </div>
          </form>

          <div style={{ marginTop: 16 }}>
            {!result ? (
              <EmptyState
                title="No dispatch result yet"
                subtitle="Submit the form to test the dispatcher. Admin-only, server-signed."
              />
            ) : result.ok ? (
              <div className="empty" style={{ borderStyle: "solid", color: "var(--success)" }}>
                ✅ {result.message}
              </div>
            ) : (
              <div className="empty" style={{ borderStyle: "solid", color: "var(--danger)" }}>
                ❌ {result.message}
              </div>
            )}
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
