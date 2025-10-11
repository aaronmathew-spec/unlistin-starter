export type ProviderInput = {
  to: string;          // sink or real recipient
  subject: string;
  text: string;        // keep simple/plaintext for phase 1
};

export type ProviderResult = {
  ok: boolean;
  id?: string;
  error?: string;
};
