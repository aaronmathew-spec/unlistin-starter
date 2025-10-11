declare module "html-to-text" {
  // Minimal surface we use in the API routes
  export function htmlToText(
    html: string,
    options?: {
      wordwrap?: number | false;
      selectors?: Array<
        | { selector: string; format: "skip" }
        | { selector: string; options?: { hideLinkHrefIfSameAsText?: boolean } }
      >;
    }
  ): string;
}
