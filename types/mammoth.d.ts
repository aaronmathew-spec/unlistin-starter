declare module "mammoth" {
  const mammoth: {
    extractRawText: (opts: { buffer: Buffer }) => Promise<{ value: string }>;
  };
  export default mammoth;
}
