// src/lib/controllers/contacts.ts
// Central registry of privacy/DPO contacts per controller.
// Keep conservative defaults; update with verified mailboxes as you go.

export const runtime = "nodejs";

export type ControllerKey =
  | "truecaller"
  | "naukri"
  | "olx"
  | "foundit"
  | "shine"
  | "timesjobs";

export type ContactInfo = {
  name: string;            // human-friendly label
  emails: string[];        // one or more target addresses
  cc?: string[];           // optional CCs (e.g., grievance officer)
  notes?: string;          // policy/quirk notes
};

export const CONTROLLER_CONTACTS: Record<ControllerKey, ContactInfo> = {
  truecaller: {
    name: "Truecaller Privacy",
    emails: ["privacy@truecaller.com"], // verify/update if you have partner contacts
    notes: "Caller ID unlisting & spam label fix; include phone and proof.",
  },
  naukri: {
    name: "Naukri Privacy/DPO",
    emails: ["privacy@naukri.com"], // placeholder; update to confirmed address
    notes: "Account/profile removal; include account email & profile URL(s).",
  },
  olx: {
    name: "OLX India Grievance",
    emails: ["grievance.officer@olx.com"], // placeholder; confirm per region
    notes: "Listings/profile removal; include URLs & screenshots.",
  },
  foundit: {
    name: "Foundit (Monster) Privacy",
    emails: ["privacy@foundit.in"], // placeholder
    notes: "Resume/profile removal; include account email and profile link.",
  },
  shine: {
    name: "Shine Privacy",
    emails: ["privacy@shine.com"], // placeholder
    notes: "Resume/profile removal; include account email.",
  },
  timesjobs: {
    name: "TimesJobs Privacy",
    emails: ["privacy@timesjobs.com"], // placeholder
    notes: "Resume/profile removal.",
  },
};

// Helper to fetch contacts safely (returns null if unknown).
export function getControllerContacts(key: string): ContactInfo | null {
  const k = key.toLowerCase() as ControllerKey;
  const entry: ContactInfo | undefined = CONTROLLER_CONTACTS[k];
  return entry ?? null;
}
