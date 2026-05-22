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

import type {
  IpcCommandEnvelope,
  IpcEventEnvelope,
  IpcEventPayload,
  IpcResponsePayload,
} from '@dexroboknix/protocol';
import {
  createIpcCommandEnvelope,
  createIpcEventEnvelope,
  parseIpcEventEnvelope,
  parseIpcResponseEnvelope,
} from '@dexroboknix/protocol';
import { invoke as tauriInvoke } from '@tauri-apps/api/core';
import { emit as tauriEmit, listen as tauriListen } from '@tauri-apps/api/event';

export const TAURI_IPC_COMMAND = 'ade_ipc_command';
export const TAURI_IPC_EVENT = 'ade.ipc.event';

export type IpcCommandInvoker = (
  command: typeof TAURI_IPC_COMMAND,
  args: { readonly envelope: IpcCommandEnvelope },
) => Promise<unknown>;

export type IpcEventListener = (
  eventName: typeof TAURI_IPC_EVENT,
  handler: (payload: unknown) => void,
) => Promise<() => void>;

export type IpcEventEmitter = (
  eventName: typeof TAURI_IPC_EVENT,
  payload: IpcEventEnvelope,
) => Promise<void>;

export interface IpcClientOptions {
  readonly createId?: () => string;
  readonly emit?: IpcEventEmitter;
  readonly invoke?: IpcCommandInvoker;
  readonly listen?: IpcEventListener;
  readonly now?: () => string;
}

export interface IpcClient {
  readonly command: <TResult = unknown>(
    command: string,
    params?: unknown,
  ) => Promise<IpcResponsePayload<TResult>>;
  readonly emit: (topic: string, data?: unknown) => Promise<void>;
  readonly listen: <TData = unknown>(
    handler: (envelope: IpcEventEnvelope<TData>) => void,
  ) => Promise<() => void>;
}

function createDefaultId(): string {
  if (globalThis.crypto?.randomUUID) {
    return globalThis.crypto.randomUUID();
  }

  return `ipc-${Date.now().toString(36)}`;
}

const defaultInvoke: IpcCommandInvoker = (command, args) =>
  tauriInvoke(command, { envelope: args.envelope });

const defaultListen: IpcEventListener = (eventName, handler) =>
  tauriListen(eventName, (event) => {
    handler(event.payload);
  });

const defaultEmit: IpcEventEmitter = (eventName, payload) => tauriEmit(eventName, payload);

export function createIpcClient(options: IpcClientOptions = {}): IpcClient {
  const createId = options.createId ?? createDefaultId;
  const emit = options.emit ?? defaultEmit;
  const invoke = options.invoke ?? defaultInvoke;
  const listen = options.listen ?? defaultListen;
  const now = options.now ?? (() => new Date().toISOString());

  return {
    async command<TResult = unknown>(
      command: string,
      params?: unknown,
    ): Promise<IpcResponsePayload<TResult>> {
      const request = createIpcCommandEnvelope({
        command,
        id: createId(),
        ...(params === undefined ? {} : { params }),
        ts: now(),
      });
      const response = parseIpcResponseEnvelope<TResult>(
        await invoke(TAURI_IPC_COMMAND, { envelope: request }),
      );

      return response.payload;
    },

    async emit(topic: string, data?: unknown): Promise<void> {
      const event = createIpcEventEnvelope({
        id: createId(),
        ...(data === undefined ? {} : { data }),
        topic,
        ts: now(),
      });

      await emit(TAURI_IPC_EVENT, event);
    },

    async listen<TData = unknown>(
      handler: (envelope: IpcEventEnvelope<TData>) => void,
    ): Promise<() => void> {
      return listen(TAURI_IPC_EVENT, (payload) => {
        handler(parseIpcEventEnvelope<TData>(payload));
      });
    },
  };
}

export type { IpcEventEnvelope, IpcEventPayload };
