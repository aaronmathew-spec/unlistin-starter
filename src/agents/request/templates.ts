// src/agents/request/templates.ts

export type SubjectProfile = {
  name?: string | null;
  email?: string | null;
  phone?: string | null;
};

export function renderEmailSubject(controllerName: string) {
  return `Data Deletion / Unlisting Request – ${controllerName}`;
}

export function renderEmailBody(
  controllerName: string,
  subject: SubjectProfile,
  locale: "en" | "hi" = "en"
) {
  const baseName = subject.name || "User";
  const emailLine = subject.email ? `Email: ${subject.email}\n` : "";
  const phoneLine = subject.phone ? `Phone: ${subject.phone}\n` : "";

  if (locale === "hi") {
    return [
      `नमस्ते ${controllerName} टीम,`,
      ``,
      `मैं आपसे अनुरोध करता/करती हूँ कि मेरे व्यक्तिगत डेटा/फोन नंबर को आपके प्लेटफ़ॉर्म से हटाया/अनलिस्ट किया जाए।`,
      `कृपया निम्नलिखित पहचान विवरण देखें:`,
      `${emailLine}${phoneLine}`,
      `मैं आपके मानक सत्यापन प्रक्रिया का पालन करने के लिए तैयार हूँ।`,
      `कृपया इस अनुरोध की रसीद/टिकट आईडी साझा करें।`,
      ``,
      `धन्यवाद,`,
      `${baseName}`,
    ].join("\n");
  }

  return [
    `Hello ${controllerName} team,`,
    ``,
    `I am requesting deletion/unlisting of my personal data / phone number from your platform.`,
    `Please find my identifiers below for verification:`,
    `${emailLine}${phoneLine}`,
    `I’m happy to comply with your standard verification process.`,
    `Please reply with a confirmation / ticket number.`,
    ``,
    `Thank you,`,
    `${baseName}`,
  ].join("\n");
}

export function renderFormPayload(url: string, subject: SubjectProfile) {
  return {
    formUrl: url,
    fields: {
      name: subject.name ?? "",
      email: subject.email ?? "",
      phone: subject.phone ?? "",
      requestType: "deletion",
    },
  };
}

/* ------------------------------------------------------------------ */
/* Site-specific templates (EN/HI)                                    */
/* ------------------------------------------------------------------ */

type SiteKey =
  | "truecaller"
  | "naukri"
  | "olx"
  | "foundit"
  | "shine"
  | "timesjobs"
  | "generic";

type Locale = "en" | "hi";

type SiteTemplate = {
  subject: (controllerName: string) => string;
  body: (controllerName: string, subject: SubjectProfile, locale: Locale) => string;
};

const genericBody = (purpose: string) => (controllerName: string, s: SubjectProfile, locale: Locale) => {
  const baseName = s.name || "User";
  const emailLine = s.email ? `Email: ${s.email}\n` : "";
  const phoneLine = s.phone ? `Phone: ${s.phone}\n` : "";

  if (locale === "hi") {
    return [
      `नमस्ते ${controllerName} टीम,`,
      ``,
      `मैं ${purpose} हेतु अनुरोध करता/करती हूँ।`,
      `कृपया सत्यापन हेतु मेरे पहचान विवरण देखें:`,
      `${emailLine}${phoneLine}`,
      `मैं किसी भी आवश्यक सत्यापन/ओटीपी/ईमेल पुष्टि के लिए तैयार हूँ।`,
      `कृपया अनुरोध की रसीद/टिकट आईडी साझा करें और हटाने की समयसीमा बताएं।`,
      ``,
      `धन्यवाद,`,
      `${baseName}`,
    ].join("\n");
  }

  return [
    `Hello ${controllerName} team,`,
    ``,
    `This is a request for ${purpose}.`,
    `For verification, here are my identifiers:`,
    `${emailLine}${phoneLine}`,
    `I will comply with any necessary verification/OTP/email confirmation.`,
    `Please share a confirmation/ticket ID and an estimated timeline.`,
    ``,
    `Thank you,`,
    `${baseName}`,
  ].join("\n");
};

const templates: Record<SiteKey, SiteTemplate> = {
  generic: {
    subject: (name) => `Data Deletion / Unlisting Request – ${name}`,
    body: genericBody("data deletion / unlisting"),
  },
  truecaller: {
    subject: (name) => `Unlisting / Number Removal – ${name}`,
    body: genericBody("phone number unlisting / data deletion"),
  },
  naukri: {
    subject: (name) => `Profile Removal & Data Deletion – ${name}`,
    body: genericBody("profile removal and personal data deletion under applicable law"),
  },
  olx: {
    subject: (name) => `Account & Listing Deletion – ${name}`,
    body: genericBody("account/profile and listing data deletion"),
  },
  foundit: {
    subject: (name) => `Resume/Profile Removal – ${name}`,
    body: genericBody("resume/profile removal and personal data deletion"),
  },
  shine: {
    subject: (name) => `Profile Deletion & Contact Removal – ${name}`,
    body: genericBody("profile deletion and contact data removal"),
  },
  timesjobs: {
    subject: (name) => `Profile Removal & Data Deletion – ${name}`,
    body: genericBody("profile removal and personal data deletion"),
  },
};

export function renderSiteSpecificEmail(
  site: SiteKey,
  controllerName: string,
  subject: SubjectProfile,
  locale: Locale = "en"
) {
  const t = templates[site] ?? templates.generic;
  return {
    subject: t.subject(controllerName),
    body: t.body(controllerName, subject, locale),
  };
}
