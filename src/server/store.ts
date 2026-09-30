import { randomUUID } from "node:crypto";
import { initialState, reduce } from "@/domain/engine";
import type { MeeCommand, MeeState } from "@/domain/types";

const g = globalThis as unknown as { __meeState?: MeeState };

export function getState(): MeeState {
  return (g.__meeState ??= initialState());
}

export function dispatch(cmd: MeeCommand): MeeState {
  g.__meeState = reduce(getState(), cmd, { now: Date.now(), id: randomUUID });
  return g.__meeState;
}
