// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 博成 · FMLC
// Additional terms: see ADDITIONAL_TERMS.md
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {ignores:['.next/**','.next-*/**','release-v*/**','dist-api/**','tts/vendor/**','tts/.runtime/**','node_modules/**','out/**','build/**','next-env.d.ts']},
  ...tseslint.configs.recommended,
  {rules:{'@typescript-eslint/no-unused-vars':['error',{ignoreRestSiblings:true,argsIgnorePattern:'^_',varsIgnorePattern:'^_'}],'@typescript-eslint/ban-ts-comment':['error',{'ts-nocheck':'allow-with-description'}]}},
  {files:['**/*.cjs'],rules:{'@typescript-eslint/no-require-imports':'off'}}
);
