// src/agents/policy/india.ts
/**
 * India DPDPA + IT Rules policy model (deterministic, typed).
 * This module encodes per-controller requirements we know today:
 * - lawful basis (consent/legitimate interest)
 * - identity & KYC expectations (email, phone, mixed, govt-id)
 * - accepted channels (email/webform/app), escalations
 * - SLA guidance & verification artifacts
 *
 * DO NOT network from here. This is pure data + helpers.
 */

export type LawfulBasis = "consent" | "contract" | "compliance" | "legitimate_interest";
export type Channel = "email" | "webform" | "app" | "phone";
export type KycMode = "email" | "phone" | "email_or_phone" | "govt_id_optional" | "none";

export type ControllerPolicy = {
  controllerKey: string;    // slug (e.g., "truecaller")
  controllerName: string;   // label
  country: "IN";
  primaryLawfulBasis: LawfulBasis;
  allowedChannels: Channel[];      // channels we may use
  preferredChannel: Channel;       // which one to try first
  identity: {
    required: boolean;             // must verify the requester?
    mode: KycMode;                 // type of verification
    hints: string[];               // UI copy / email copy nudges
  };
  slas: {
    acknowledgeHours?: number;     // usual acknowledgement timeframe (hint)
    resolutionDays?: number;       // expected deletion/unlisting within N days
    recheckHours?: number;         // when to schedule a recheck job
  };
  verificationArtifacts: Array<
    | "email_otp"
    | "phone_otp"
    | "outbound_email_log"
    | "webform_html_capture"
    | "screenshot"
    | "controller_ack_email"
    | "controller_ticket_id"
  >;
  escalation: {
    fallbackChannel?: Channel;     // try if primary fails
    notes?: string[];
  };
  localeCopy: {
    // short strings you may surface in the UI/workers
    en: { requestPurpose: string; dataCategories: string[]; },
    hi: { requestPurpose: string; dataCategories: string[]; },
  };
};

type PolicyMap = Record<string, ControllerPolicy>;

/**
 * Authoritative per-site policies
 * Keep conservative defaults; tune as you validate real flows.
 */
export const INDIA_POLICIES: PolicyMap = {
  truecaller: {
    controllerKey: "truecaller",
    controllerName: "Truecaller",
    country: "IN",
    primaryLawfulBasis: "legitimate_interest",
    allowedChannels: ["webform", "email"],
    preferredChannel: "webform",
    identity: {
      required: true,
      mode: "phone",
      hints: [
        "Have the requester’s phone available for OTP verification.",
        "If OTP fails, attach email proof linking identity to phone.",
      ],
    },
    slas: { acknowledgeHours: 72, resolutionDays: 30, recheckHours: 96 },
    verificationArtifacts: [
      "webform_html_capture",
      "screenshot",
      "controller_ticket_id",
      "outbound_email_log",
    ],
    escalation: {
      fallbackChannel: "email",
      notes: ["Include number hash/last-4 and approx. discovery date in the email body."],
    },
    localeCopy: {
      en: {
        requestPurpose: "Phone number unlisting & deletion",
        dataCategories: ["Phone number", "Name", "Linked metadata"],
      },
      hi: {
        requestPurpose: "फ़ोन नंबर अनलिस्टिंग व डिलीशन",
        dataCategories: ["फ़ोन नंबर", "नाम", "लिंक्ड मेटाडेटा"],
      },
    },
  },

  naukri: {
    controllerKey: "naukri",
    controllerName: "Naukri",
    country: "IN",
    primaryLawfulBasis: "legitimate_interest",
    allowedChannels: ["email", "webform"],
    preferredChannel: "email",
    identity: {
      required: true,
      mode: "email_or_phone",
      hints: ["Use registered email if known; otherwise provide phone with city context."],
    },
    slas: { acknowledgeHours: 72, resolutionDays: 30, recheckHours: 96 },
    verificationArtifacts: ["outbound_email_log", "controller_ack_email", "controller_ticket_id"],
    escalation: { notes: ["Attach resume/profile locator if known."] },
    localeCopy: {
      en: {
        requestPurpose: "Profile removal & personal data deletion",
        dataCategories: ["Profile", "Resume", "Contact details", "Listings"],
      },
      hi: {
        requestPurpose: "प्रोफ़ाइल हटाना एवं व्यक्तिगत डेटा डिलीशन",
        dataCategories: ["प्रोफ़ाइल", "रिज़्यूमे", "संपर्क विवरण", "लिस्टिंग"],
      },
    },
  },

  olx: {
    controllerKey: "olx",
    controllerName: "OLX",
    country: "IN",
    primaryLawfulBasis: "legitimate_interest",
    allowedChannels: ["email", "webform"],
    preferredChannel: "email",
    identity: {
      required: true,
      mode: "email_or_phone",
      hints: ["Reference approximate listing title/category if possible."],
    },
    slas: { acknowledgeHours: 72, resolutionDays: 30, recheckHours: 96 },
    verificationArtifacts: ["outbound_email_log", "controller_ack_email", "controller_ticket_id"],
    escalation: {},
    localeCopy: {
      en: {
        requestPurpose: "Account/profile & listing deletion",
        dataCategories: ["Account", "Profile", "Listings", "Contact info"],
      },
      hi: {
        requestPurpose: "अकाउंट/प्रोफ़ाइल व लिस्टिंग डिलीशन",
        dataCategories: ["अकाउंट", "प्रोफ़ाइल", "लिस्टिंग्स", "संपर्क सूचना"],
      },
    },
  },

  foundit: {
    controllerKey: "foundit",
    controllerName: "Foundit",
    country: "IN",
    primaryLawfulBasis: "legitimate_interest",
    allowedChannels: ["email", "webform"],
    preferredChannel: "email",
    identity: {
      required: true,
      mode: "email_or_phone",
      hints: ["Provide resume email or phone; city helps disambiguate."],
    },
    slas: { acknowledgeHours: 72, resolutionDays: 30, recheckHours: 96 },
    verificationArtifacts: ["outbound_email_log", "controller_ack_email", "controller_ticket_id"],
    escalation: {},
    localeCopy: {
      en: {
        requestPurpose: "Resume/profile removal & personal data deletion",
        dataCategories: ["Profile", "Resume", "Contact info"],
      },
      hi: {
        requestPurpose: "रिज़्यूमे/प्रोफ़ाइल हटाना एवं व्यक्तिगत डेटा डिलीशन",
        dataCategories: ["प्रोफ़ाइल", "रिज़्यूमे", "संपर्क जानकारी"],
      },
    },
  },

  shine: {
    controllerKey: "shine",
    controllerName: "Shine",
    country: "IN",
    primaryLawfulBasis: "legitimate_interest",
    allowedChannels: ["email", "webform"],
    preferredChannel: "email",
    identity: {
      required: true,
      mode: "email_or_phone",
      hints: ["Use registered email; if unknown, include phone with city."],
    },
    slas: { acknowledgeHours: 72, resolutionDays: 30, recheckHours: 96 },
    verificationArtifacts: ["outbound_email_log", "controller_ack_email", "controller_ticket_id"],
    escalation: {},
    localeCopy: {
      en: {
        requestPurpose: "Profile deletion & contact removal",
        dataCategories: ["Profile", "Contact info"],
      },
      hi: {
        requestPurpose: "प्रोफ़ाइल डिलीशन व संपर्क हटाना",
        dataCategories: ["प्रोफ़ाइल", "संपर्क जानकारी"],
      },
    },
  },

  timesjobs: {
    controllerKey: "timesjobs",
    controllerName: "TimesJobs",
    country: "IN",
    primaryLawfulBasis: "legitimate_interest",
    allowedChannels: ["email", "webform"],
    preferredChannel: "email",
    identity: {
      required: true,
      mode: "email_or_phone",
      hints: ["Attach job-search URL or keywords if available."],
    },
    slas: { acknowledgeHours: 72, resolutionDays: 30, recheckHours: 96 },
    verificationArtifacts: ["outbound_email_log", "controller_ack_email", "controller_ticket_id"],
    escalation: {},
    localeCopy: {
      en: {
        requestPurpose: "Profile removal & personal data deletion",
        dataCategories: ["Profile", "Resume", "Contact info"],
      },
      hi: {
        requestPurpose: "प्रोफ़ाइल हटाना एवं व्यक्तिगत डेटा डिलीशन",
        dataCategories: ["प्रोफ़ाइल", "रिज़्यूमे", "संपर्क जानकारी"],
      },
    },
  },
};

/** Safe getter; falls back to a conservative generic policy if missing */
export function getIndiaPolicy(controllerKey: string): ControllerPolicy {
  const k = controllerKey.toLowerCase();
  const p = INDIA_POLICIES[k];
  if (p) return p;

  // Generic, conservative fallback for India
  return {
    controllerKey: k,
    controllerName: controllerKey,
    country: "IN",
    primaryLawfulBasis: "legitimate_interest",
    allowedChannels: ["email"],
    preferredChannel: "email",
    identity: {
      required: true,
      mode: "email_or_phone",
      hints: ["Use email if known, else phone + city."],
    },
    slas: { acknowledgeHours: 96, resolutionDays: 30, recheckHours: 120 },
    verificationArtifacts: ["outbound_email_log", "controller_ack_email"],
    escalation: {},
    localeCopy: {
      en: { requestPurpose: "Personal data deletion", dataCategories: ["Contact info", "Profile"] },
      hi: { requestPurpose: "व्यक्तिगत डेटा डिलीशन", dataCategories: ["संपर्क जानकारी", "प्रोफ़ाइल"] },
    },
  };
}
