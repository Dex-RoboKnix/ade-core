/*
 * Agent Desktop Environment (ADE)
 * Copyright (C) 2026  DexRoboKnix
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as
 * published by the Free Software Foundation, either version 3 of the
 * License, or (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */

import { z } from 'zod';

import {
  createProtocolEnvelope,
  type PROTOCOL_VERSION,
  type ProtocolEnvelope,
  ProtocolEnvelopeSchema,
  ProtocolMessageKindSchema,
} from './envelope';

export const IPC_COMMAND_KIND = 'ipc.command';
export const IPC_RESPONSE_KIND = 'ipc.response';
export const IPC_EVENT_KIND = 'ipc.event';
export const IPC_ERROR_KIND = 'ipc.error';

export const IpcCommandNameSchema = ProtocolMessageKindSchema;
export const IpcEventTopicSchema = ProtocolMessageKindSchema;

export const IpcCommandPayloadSchema = z
  .object({
    command: IpcCommandNameSchema,
    params: z.unknown().optional(),
  })
  .strict();

export const IpcResponsePayloadSchema = z
  .object({
    command: IpcCommandNameSchema,
    result: z.unknown(),
  })
  .strict();

export const IpcEventPayloadSchema = z
  .object({
    topic: IpcEventTopicSchema,
    data: z.unknown().optional(),
  })
  .strict();

export const IpcCommandEnvelopeSchema = ProtocolEnvelopeSchema.extend({
  kind: z.literal(IPC_COMMAND_KIND),
  payload: IpcCommandPayloadSchema,
}).strict();

export const IpcResponseEnvelopeSchema = ProtocolEnvelopeSchema.extend({
  kind: z.literal(IPC_RESPONSE_KIND),
  payload: IpcResponsePayloadSchema,
}).strict();

export const IpcEventEnvelopeSchema = ProtocolEnvelopeSchema.extend({
  kind: z.literal(IPC_EVENT_KIND),
  payload: IpcEventPayloadSchema,
}).strict();

export type IpcCommandName = z.infer<typeof IpcCommandNameSchema>;
export type IpcEventTopic = z.infer<typeof IpcEventTopicSchema>;
export type IpcCommandPayload = z.infer<typeof IpcCommandPayloadSchema>;

type IpcResponsePayloadBase = z.infer<typeof IpcResponsePayloadSchema>;
type IpcEventPayloadBase = z.infer<typeof IpcEventPayloadSchema>;

export type IpcResponsePayload<TResult = unknown> = Omit<IpcResponsePayloadBase, 'result'> & {
  readonly result: TResult;
};

export type IpcEventPayload<TData = unknown> = Omit<IpcEventPayloadBase, 'data'> & {
  readonly data?: TData;
};

export type IpcCommandEnvelope = ProtocolEnvelope<IpcCommandPayload> & {
  readonly kind: typeof IPC_COMMAND_KIND;
};

export type IpcResponseEnvelope<TResult = unknown> = ProtocolEnvelope<
  IpcResponsePayload<TResult>
> & {
  readonly kind: typeof IPC_RESPONSE_KIND;
};

export type IpcEventEnvelope<TData = unknown> = ProtocolEnvelope<IpcEventPayload<TData>> & {
  readonly kind: typeof IPC_EVENT_KIND;
};

interface ProtocolEnvelopeOptions {
  readonly id: string;
  readonly ts?: string;
  readonly v?: typeof PROTOCOL_VERSION;
}

export interface CreateIpcCommandEnvelopeInput extends ProtocolEnvelopeOptions {
  readonly command: IpcCommandName;
  readonly params?: unknown;
}

export interface CreateIpcResponseEnvelopeInput<TResult = unknown> extends ProtocolEnvelopeOptions {
  readonly command: IpcCommandName;
  readonly result: TResult;
}

export interface CreateIpcEventEnvelopeInput<TData = unknown> extends ProtocolEnvelopeOptions {
  readonly topic: IpcEventTopic;
  readonly data?: TData;
}

export function createIpcCommandEnvelope(input: CreateIpcCommandEnvelopeInput): IpcCommandEnvelope {
  const payload =
    input.params === undefined
      ? { command: input.command }
      : { command: input.command, params: input.params };

  return IpcCommandEnvelopeSchema.parse(
    createProtocolEnvelope({
      id: input.id,
      kind: IPC_COMMAND_KIND,
      payload,
      ...(input.ts === undefined ? {} : { ts: input.ts }),
      ...(input.v === undefined ? {} : { v: input.v }),
    }),
  ) as IpcCommandEnvelope;
}

export function createIpcResponseEnvelope<TResult>(
  input: CreateIpcResponseEnvelopeInput<TResult>,
): IpcResponseEnvelope<TResult> {
  return IpcResponseEnvelopeSchema.parse(
    createProtocolEnvelope({
      id: input.id,
      kind: IPC_RESPONSE_KIND,
      payload: {
        command: input.command,
        result: input.result,
      },
      ...(input.ts === undefined ? {} : { ts: input.ts }),
      ...(input.v === undefined ? {} : { v: input.v }),
    }),
  ) as IpcResponseEnvelope<TResult>;
}

export function createIpcEventEnvelope<TData>(
  input: CreateIpcEventEnvelopeInput<TData>,
): IpcEventEnvelope<TData> {
  const payload =
    input.data === undefined ? { topic: input.topic } : { topic: input.topic, data: input.data };

  return IpcEventEnvelopeSchema.parse(
    createProtocolEnvelope({
      id: input.id,
      kind: IPC_EVENT_KIND,
      payload,
      ...(input.ts === undefined ? {} : { ts: input.ts }),
      ...(input.v === undefined ? {} : { v: input.v }),
    }),
  ) as IpcEventEnvelope<TData>;
}

export function parseIpcCommandEnvelope(input: unknown): IpcCommandEnvelope {
  return IpcCommandEnvelopeSchema.parse(input) as IpcCommandEnvelope;
}

export function parseIpcResponseEnvelope<TResult = unknown>(
  input: unknown,
): IpcResponseEnvelope<TResult> {
  return IpcResponseEnvelopeSchema.parse(input) as IpcResponseEnvelope<TResult>;
}

export function parseIpcEventEnvelope<TData = unknown>(input: unknown): IpcEventEnvelope<TData> {
  return IpcEventEnvelopeSchema.parse(input) as IpcEventEnvelope<TData>;
}
