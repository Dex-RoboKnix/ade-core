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

export const ADE_ERROR_DEFINITIONS = {
  E_FS_PERMISSION_DENIED: {
    status: 403,
    title: 'Filesystem permission denied',
    type: 'https://dexroboknix.com/problems/fs-permission-denied',
  },
  E_AGENT_BACKEND_UNAVAILABLE: {
    status: 503,
    title: 'Agent backend unavailable',
    type: 'https://dexroboknix.com/problems/agent-backend-unavailable',
  },
  E_ENTITLEMENT_REQUIRED: {
    status: 402,
    title: 'Entitlement required',
    type: 'https://dexroboknix.com/problems/entitlement-required',
  },
  E_PROTOCOL_VERSION_UNSUPPORTED: {
    status: 426,
    title: 'Protocol version unsupported',
    type: 'https://dexroboknix.com/problems/protocol-version-unsupported',
  },
  E_VALIDATION_FAILED: {
    status: 400,
    title: 'Validation failed',
    type: 'https://dexroboknix.com/problems/validation-failed',
  },
  E_INTERNAL: {
    status: 500,
    title: 'Internal error',
    type: 'https://dexroboknix.com/problems/internal',
  },
} as const;

export type AdeErrorCode = keyof typeof ADE_ERROR_DEFINITIONS;

export interface ProblemDetails {
  readonly type: string;
  readonly title: string;
  readonly status: number;
  readonly detail: string;
  readonly instance?: string;
  readonly code: AdeErrorCode;
}

export interface CreateAdeErrorOptions {
  readonly instance?: string;
}

export class AdeError extends Error {
  readonly code: AdeErrorCode;
  readonly problem: ProblemDetails;

  constructor(problem: ProblemDetails) {
    super(problem.title);
    this.name = 'AdeError';
    this.code = problem.code;
    this.problem = problem;
  }

  toProblemDetails(): ProblemDetails {
    return this.problem;
  }
}

export function createProblemDetails(
  code: AdeErrorCode,
  detail: string,
  options: CreateAdeErrorOptions = {},
): ProblemDetails {
  const definition = ADE_ERROR_DEFINITIONS[code];

  const problem: ProblemDetails = {
    code,
    detail,
    status: definition.status,
    title: definition.title,
    type: definition.type,
  };

  if (options.instance !== undefined) {
    return {
      ...problem,
      instance: options.instance,
    };
  }

  return problem;
}

export function createAdeError(
  code: AdeErrorCode,
  detail: string,
  options: CreateAdeErrorOptions = {},
): AdeError {
  return new AdeError(createProblemDetails(code, detail, options));
}
