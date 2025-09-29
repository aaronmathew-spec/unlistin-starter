// agents/{{slice}}.ts
import { z } from "zod";

export const {{Slice}}Output = z.object({
  ok: z.boolean(),
  message: z.string()
});
export type {{Slice}}Output = z.infer<typeof {{Slice}}Output>;

export async function run{{Slice}}Agent(input: { prompt: string }): Promise<{{Slice}}Output> {
  return {{Slice}}Output.parse({ ok: true, message: `Echo: ${input.prompt.slice(0, 200)}` });
}
