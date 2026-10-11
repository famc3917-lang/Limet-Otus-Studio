// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 博成 · FMLC
// Additional terms: see ADDITIONAL_TERMS.md
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images:{unoptimized:true},
  allowedDevOrigins: ['127.0.0.1'],
  distDir: process.env.STUDIO_BUILD_DIR || '.next',
  /* EXE 封装：输出 standalone 服务器，由 Electron 外壳启动 */
  output: "standalone",
  // ASR 由独立 speech 资源项提供，避免每条 API 追踪重复包含模型与原生库。
  outputFileTracingExcludes: { '/*': ['./speech/**/*', './tts/**/*'] },
};

export default nextConfig;
