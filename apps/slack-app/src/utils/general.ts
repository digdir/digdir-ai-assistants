// Small helpers copied from @digdir/assistant-lib. Importing that package runs its
// Typesense and OpenAI setup at module load, which the genki backend does not need.
import { z } from 'zod';

export function envVar(varName: string, defaultValue: any = null): any {
  const fullName =
    (process.env.DIGDIR_SLACK_BOT_PREFIX || '') +
    varName +
    (process.env.DIGDIR_SLACK_BOT_POSTFIX || '');
  return process.env[fullName] || defaultValue;
}

export function isNullOrEmpty(inputStr: string | null | undefined): boolean {
  return inputStr === undefined || inputStr === null || inputStr === '';
}

export function lapTimer(startTime: number): number {
  return (performance.now() - startTime) * 0.001;
}

export function round(num: number, decimals: number = 1): number {
  return Number(num.toFixed(decimals));
}

export function stripCodeBlockLang(codeBlock: string): string {
  let fixed = codeBlock;
  while (fixed.indexOf('```') >= 0 && fixed.indexOf('```') != fixed.indexOf('```\n')) {
    const start = fixed.indexOf('```');
    const lineEnd = fixed.indexOf('\n', start);
    if (lineEnd < 0) {
      // an unterminated fence at the very end of a streamed draft
      break;
    }
    fixed = fixed.substring(0, start + 3) + fixed.substring(lineEnd);
  }
  return fixed;
}

export interface ZSchemaInterface<T extends z.ZodRawShape, TObject = z.ZodObject<T>> {
  new (data: z.infer<z.ZodObject<T>>): z.infer<z.ZodObject<T>>;

  schema: TObject;

  parse<TFinal extends new (data: z.infer<z.ZodObject<T>>) => InstanceType<TFinal>>(
    this: TFinal,
    value: z.infer<z.ZodObject<T>>,
  ): InstanceType<TFinal>;
}

export function ZSchema<
  T extends z.ZodRawShape,
  Type = ZSchemaInterface<T> & z.infer<z.ZodObject<T>>,
>(schema: z.ZodObject<T>): Type {
  const res = class {
    static schema = schema;
    public constructor(value: z.infer<z.ZodObject<T>>) {
      Object.assign(this, schema.parse(value));
    }
    static parse<T extends typeof res>(this: T, value: unknown): any {
      return new this(schema.parse(value)) as any;
    }
  };
  return res as typeof res & any;
}
