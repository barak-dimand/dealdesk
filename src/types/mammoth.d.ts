declare module "mammoth" {
  interface ExtractRawTextResult {
    value: string;
    messages: Array<{ type: string; message: string }>;
  }
  function extractRawText(input: { buffer: Buffer }): Promise<ExtractRawTextResult>;
}
