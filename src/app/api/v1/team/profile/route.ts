// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 博成 · FMLC
// Additional terms: see ADDITIONAL_TERMS.md
import {handleAPI} from '@/server/http';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export const GET=handleAPI,POST=handleAPI,PATCH=handleAPI,PUT=handleAPI,DELETE=handleAPI;
