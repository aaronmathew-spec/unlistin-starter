export type Broker = {
  slug: string;
  name: string;
  category: "data_broker" | "social" | "search_engine" | "people_search" | "misc";
  homepage: string;
  country: "IN" | "GLOBAL" | "US" | "EU" | "OTHER";
  removalUrl?: string;
  notes?: string;
};

export const BROKERS: Broker[] = [
  {
    slug: "truecaller",
    name: "Truecaller",
    category: "data_broker",
    homepage: "https://www.truecaller.com",
    country: "GLOBAL",
    removalUrl: "https://www.truecaller.com/unlisting",
    notes: "Phone-based identity; requires number verification for unlisting.",
  },
  {
    slug: "justdial",
    name: "Justdial",
    category: "data_broker",
    homepage: "https://www.justdial.com",
    country: "IN",
    notes: "Business listings; personal data may appear via scraped info.",
  },
  {
    slug: "linkedin",
    name: "LinkedIn",
    category: "social",
    homepage: "https://www.linkedin.com",
    country: "GLOBAL",
    notes: "Adjust privacy settings; remove public profile indexing.",
  },
  {
    slug: "facebook",
    name: "Facebook",
    category: "social",
    homepage: "https://www.facebook.com",
    country: "GLOBAL",
    notes: "Privacy settings & account removal options.",
  },
  {
    slug: "google-search",
    name: "Google Search",
    category: "search_engine",
    homepage: "https://www.google.com",
    country: "GLOBAL",
    removalUrl: "https://support.google.com/websearch/troubleshooter/3111061",
    notes: "Right-to-remove forms for personal content.",
  },
  {
    slug: "haveibeenpwned",
    name: "Have I Been Pwned",
    category: "misc",
    homepage: "https://haveibeenpwned.com",
    country: "GLOBAL",
    notes: "Breach monitoring, not a broker; good for awareness.",
  },
];

export function getBrokerBySlug(slug: string): Broker | undefined {
  return BROKERS.find((b) => b.slug === slug);
}
