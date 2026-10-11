// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 博成 · FMLC
// Additional terms: see ADDITIONAL_TERMS.md
/** Service boundary. All access requires a server-authenticated principal. */
export {handleAPI,boundedJson} from '@/server/http';
export {getState,saveState,command} from '@/server/repository';
export {authenticate,requireScope} from '@/server/security';
