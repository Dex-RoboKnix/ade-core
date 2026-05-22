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

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  PROTOCOL_VERSION,
  ProtocolEnvelopeSchema,
  ProtocolProblemDetailsSchema,
} from '../src/envelope';
import {
  IpcCommandPayloadSchema,
  IpcEventPayloadSchema,
  IpcResponsePayloadSchema,
} from '../src/ipc';

interface RustTypeSpec {
  readonly docs: string;
  readonly fieldDocs: Readonly<Record<string, string>>;
  readonly name: string;
  readonly schema: unknown;
}

interface ZodDefinition {
  readonly catchall?: unknown;
  readonly innerType?: unknown;
  readonly shape?: unknown;
  readonly type?: unknown;
  readonly values?: readonly unknown[];
}

const HEADER = `/*
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
`;

const RUST_TYPES: readonly RustTypeSpec[] = [
  {
    docs: 'Typed command payload carried by IPC command envelopes.',
    fieldDocs: {
      command: 'Dot-delimited IPC command name.',
      params: 'Command-specific input payload.',
    },
    name: 'IpcCommandPayload',
    schema: IpcCommandPayloadSchema,
  },
  {
    docs: 'Typed success payload carried by IPC response envelopes.',
    fieldDocs: {
      command: 'Dot-delimited IPC command name that produced this response.',
      result: 'Command-specific output payload.',
    },
    name: 'IpcResponsePayload',
    schema: IpcResponsePayloadSchema,
  },
  {
    docs: 'Typed event payload carried by IPC event envelopes.',
    fieldDocs: {
      data: 'Event-specific payload.',
      topic: 'Dot-delimited IPC event topic.',
    },
    name: 'IpcEventPayload',
    schema: IpcEventPayloadSchema,
  },
  {
    docs: 'RFC 9457-style error payload carried by protocol envelopes.',
    fieldDocs: {
      code: 'Stable ADE error code.',
      detail: 'Human-readable diagnostic detail.',
      instance: 'Optional message, session, or resource instance identifier.',
      status: 'HTTP status code aligned with the problem type.',
      title: 'Short, stable summary of the problem type.',
      type: 'Canonical problem type URL.',
    },
    name: 'ProtocolProblemDetails',
    schema: ProtocolProblemDetailsSchema,
  },
  {
    docs: 'Versioned envelope shared by IPC, bridge, and MCP messages.',
    fieldDocs: {
      id: 'Unique message id within the sending context.',
      kind: 'Dot-delimited lowercase message kind.',
      payload: 'Schema-specific success payload or Problem Details error payload.',
      ts: 'Canonical ISO 8601 UTC timestamp.',
      v: 'Protocol envelope version.',
    },
    name: 'ProtocolEnvelope',
    schema: ProtocolEnvelopeSchema,
  },
];

const RUST_KEYWORDS = new Set(['type']);

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const tauriSourceDirectory = resolve(scriptDirectory, '../../../apps/shell/src-tauri/src');
const generatedDirectory = resolve(tauriSourceDirectory, 'generated');

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === 'object' && value !== null;
}

function definitionFor(schema: unknown): ZodDefinition {
  if (!isRecord(schema)) {
    throw new TypeError('Expected a Zod schema object.');
  }

  const definition = schema._def ?? schema.def;

  if (!isRecord(definition)) {
    throw new TypeError('Expected a Zod schema definition.');
  }

  return definition as ZodDefinition;
}

function schemaShape(schema: unknown): Readonly<Record<string, unknown>> {
  const definition = definitionFor(schema);

  if (definition.type !== 'object' || !isRecord(definition.shape)) {
    throw new TypeError('Rust code generation only supports Zod object schemas.');
  }

  return definition.shape;
}

function isStrictObject(schema: unknown): boolean {
  const catchall = definitionFor(schema).catchall;

  return catchall !== undefined && definitionFor(catchall).type === 'never';
}

function optionalInnerSchema(schema: unknown): unknown | undefined {
  const definition = definitionFor(schema);

  if (definition.type !== 'optional') {
    return undefined;
  }

  return definition.innerType;
}

function rustFieldName(fieldName: string): string {
  if (fieldName === 'type') {
    return 'problem_type';
  }

  if (RUST_KEYWORDS.has(fieldName)) {
    return `${fieldName}_`;
  }

  return fieldName;
}

function rustTypeFor(schema: unknown): string {
  const optionalSchema = optionalInnerSchema(schema);

  if (optionalSchema !== undefined) {
    return `Option<${rustTypeFor(optionalSchema)}>`;
  }

  const definition = definitionFor(schema);

  if (definition.type === 'string') {
    return 'String';
  }

  if (definition.type === 'unknown') {
    return 'serde_json::Value';
  }

  if (definition.type === 'literal') {
    const literalValue = definition.values?.[0];

    if (typeof literalValue === 'number') {
      return 'u16';
    }

    if (typeof literalValue === 'string') {
      return 'String';
    }
  }

  if (definition.type === 'number') {
    return rustIntegerTypeFor(schema);
  }

  throw new TypeError(`Unsupported Zod schema kind for Rust code generation: ${definition.type}`);
}

function rustIntegerTypeFor(schema: unknown): string {
  const metadata = isRecord(schema) ? schema : {};
  const minValue = metadata.minValue;
  const maxValue = metadata.maxValue;

  if (typeof minValue === 'number' && minValue >= 0 && typeof maxValue === 'number') {
    return maxValue <= 255 ? 'u8' : 'u16';
  }

  return 'i64';
}

function renderDocComment(text: string, indent = ''): string {
  return text
    .split('\n')
    .map((line) => `${indent}/// ${line}`)
    .join('\n');
}

function renderField(schema: unknown, fieldName: string, docs: string | undefined): string {
  const rustName = rustFieldName(fieldName);
  const attributes: string[] = [];

  if (rustName !== fieldName) {
    attributes.push(`#[serde(rename = "${fieldName}")]`);
  }

  if (optionalInnerSchema(schema) !== undefined) {
    attributes.push('#[serde(skip_serializing_if = "Option::is_none")]');
  }

  return [
    docs === undefined ? undefined : renderDocComment(docs, '    '),
    ...attributes.map((attribute) => `    ${attribute}`),
    `    pub ${rustName}: ${rustTypeFor(schema)},`,
  ]
    .filter((line) => line !== undefined)
    .join('\n');
}

function renderStruct(typeSpec: RustTypeSpec): string {
  const shape = schemaShape(typeSpec.schema);
  const attributes = [
    '#[derive(Clone, Debug, Eq, PartialEq, serde::Deserialize, serde::Serialize)]',
  ];

  if (isStrictObject(typeSpec.schema)) {
    attributes.push('#[serde(deny_unknown_fields)]');
  }

  const fields = Object.entries(shape).map(([fieldName, schema]) =>
    renderField(schema, fieldName, typeSpec.fieldDocs[fieldName]),
  );

  return [
    renderDocComment(typeSpec.docs),
    ...attributes,
    `pub struct ${typeSpec.name} {`,
    fields.join('\n'),
    '}',
  ].join('\n');
}

function renderProtocolModule(): string {
  const structs = RUST_TYPES.map(renderStruct).join('\n\n');

  return `${HEADER}
//! Generated Rust protocol types from the TypeScript Zod schemas.
//!
//! Do not edit by hand. Run \`pnpm --filter @dexroboknix/protocol codegen:rust\`.

/// Current protocol envelope version generated from TypeScript.
pub const PROTOCOL_VERSION: u16 = ${PROTOCOL_VERSION};

${structs}
`;
}

function renderGeneratedModule(): string {
  return `${HEADER}
//! Generated Rust bindings shared with TypeScript protocol schemas.
//!
//! Do not edit by hand. Run \`pnpm --filter @dexroboknix/protocol codegen:rust\`.

/// Protocol envelope types generated from Zod schemas.
pub mod protocol;
`;
}

async function writeIfChanged(path: string, content: string): Promise<void> {
  let current: string | undefined;

  try {
    current = await readFile(path, 'utf8');
  } catch (error) {
    const code = isRecord(error) ? error.code : undefined;

    if (code !== 'ENOENT') {
      throw error;
    }
  }

  if (current !== content) {
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, content, 'utf8');
  }
}

async function main(): Promise<void> {
  await writeIfChanged(resolve(generatedDirectory, 'mod.rs'), renderGeneratedModule());
  await writeIfChanged(resolve(generatedDirectory, 'protocol.rs'), renderProtocolModule());
}

void main();
