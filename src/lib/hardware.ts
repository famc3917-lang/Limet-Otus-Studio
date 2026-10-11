// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 博成 · FMLC
// Additional terms: see ADDITIONAL_TERMS.md
/** Reader adapters are supplied by a trusted, bundled driver; never load arbitrary remote code. */
export interface HardwareReader {id:string;name:string;kind:'sd'|'nfc';connect():Promise<void>;disconnect():Promise<void>;signChallenge?(message:string):Promise<string>}
const readers=new Map<string,HardwareReader>();
export function registerHardwareReader(reader:HardwareReader){if(!/^[a-z][a-z0-9.-]+$/.test(reader.id)||readers.has(reader.id))throw new Error('硬件驱动标识无效或重复');readers.set(reader.id,reader);return ()=>readers.delete(reader.id);}
export const hardwareReaders=()=>Array.from(readers.values());
