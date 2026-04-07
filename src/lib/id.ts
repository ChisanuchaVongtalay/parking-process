import { customAlphabet } from "nanoid";

const alphabet = "0123456789abcdefghijklmnopqrstuvwxyz";
const nano = customAlphabet(alphabet, 16);

export function createId(prefix: string): string {
  return `${prefix}_${nano()}`;
}
