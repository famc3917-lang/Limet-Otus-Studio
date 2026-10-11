// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 博成 · FMLC
// Additional terms: see ADDITIONAL_TERMS.md
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {ignores:['.next/**','.next-*/**','release-v*/**','dist-api/**','tts/vendor/**','tts/.runtime/**','node_modules/**','out/**','build/**','next-env.d.ts']},
  ...tseslint.configs.recommended,
  {files:['**/*.cjs'],rules:{'@typescript-eslint/no-require-imports':'off'}}
);
