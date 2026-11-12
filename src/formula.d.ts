import type { Blow } from "./protocol";
export interface Traits {
  mass: string;
  heart: string;
  temper: string;
  grain: string;
  steered: string;
  light: string;
}
export function traits(blows: Blow[]): Promise<Traits>;
