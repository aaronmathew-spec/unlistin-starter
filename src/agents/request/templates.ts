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
  // For MVP: return a generic shape your form worker can use.
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
