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

export const PROTOCOL_VERSION = 1;

const UTC_TIMESTAMP_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
const MESSAGE_KIND_PATTERN = /^[a-z][a-z0-9-]*(?:\.[a-z][a-z0-9-]*)+$/;
const PROBLEM_CODE_PATTERN = /^E_[A-Z0-9_]+$/;

function isCanonicalUtcTimestamp(value: string): boolean {
  if (!UTC_TIMESTAMP_PATTERN.test(value)) {
    return false;
  }

  const parsed = Date.parse(value);

  return !Number.isNaN(parsed) && new Date(parsed).toISOString() === value;
}

export const ProtocolMessageIdSchema = z
  .string()
  .refine((value) => value.trim().length > 0, 'Message id must not be blank.');

export const ProtocolMessageKindSchema = z
  .string()
  .regex(MESSAGE_KIND_PATTERN, 'Message kind must be dot-delimited lowercase segments.');

export const ProtocolUtcTimestampSchema = z
  .string()
  .refine(isCanonicalUtcTimestamp, 'Timestamp must be canonical ISO 8601 UTC.');

export const ProtocolProblemDetailsSchema = z
  .object({
    code: z
      .string()
      .regex(PROBLEM_CODE_PATTERN, 'Problem code must use the ADE error code format.'),
    detail: z.string().min(1),
    instance: z.string().min(1).optional(),
    status: z.number().int().min(100).max(599),
    title: z.string().min(1),
    type: z.string().url(),
  })
  .strict();

export const ProtocolEnvelopeSchema = z
  .object({
    id: ProtocolMessageIdSchema,
    kind: ProtocolMessageKindSchema,
    payload: z.unknown(),
    ts: ProtocolUtcTimestampSchema,
    v: z.literal(PROTOCOL_VERSION),
  })
  .strict();

type ProtocolEnvelopeBase = z.infer<typeof ProtocolEnvelopeSchema>;

export type ProtocolMessageKind = z.infer<typeof ProtocolMessageKindSchema>;
export type ProtocolProblemDetails = z.infer<typeof ProtocolProblemDetailsSchema>;
export type ProtocolUtcTimestamp = z.infer<typeof ProtocolUtcTimestampSchema>;

export type ProtocolEnvelope<TPayload = unknown> = Omit<ProtocolEnvelopeBase, 'payload'> & {
  readonly payload: TPayload;
};

export interface CreateProtocolEnvelopeInput<TPayload> {
  readonly id: string;
  readonly kind: ProtocolMessageKind;
  readonly payload: TPayload;
  readonly ts?: string;
  readonly v?: typeof PROTOCOL_VERSION;
}

export function createProtocolEnvelope<TPayload>(
  input: CreateProtocolEnvelopeInput<TPayload>,
): ProtocolEnvelope<TPayload> {
  return ProtocolEnvelopeSchema.parse({
    id: input.id,
    kind: input.kind,
    payload: input.payload,
    ts: input.ts ?? new Date().toISOString(),
    v: input.v ?? PROTOCOL_VERSION,
  }) as ProtocolEnvelope<TPayload>;
}

export function parseProtocolEnvelope<TPayload = unknown>(
  input: unknown,
): ProtocolEnvelope<TPayload> {
  return ProtocolEnvelopeSchema.parse(input) as ProtocolEnvelope<TPayload>;
}

export function isProtocolEnvelope(input: unknown): input is ProtocolEnvelope {
  return ProtocolEnvelopeSchema.safeParse(input).success;
}

export function isProtocolProblemDetails(input: unknown): input is ProtocolProblemDetails {
  return ProtocolProblemDetailsSchema.safeParse(input).success;
}
