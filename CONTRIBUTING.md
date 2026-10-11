# Contributing / 参与贡献

[English](#english) · [中文](#中文)

## English

Thank you for your interest in Limet Otus Studio.

### Setup

```sh
npm ci
npm run dev
```

Node.js 24 is required. See the [developer manual](docs/English/Developer-manual.md) for architecture, environment variables and builds.

### Before opening a pull request

```sh
npm run typecheck
npx eslint .
npm run check
npm run test:team
npm run test:v3-workflow
npm run test:retention
```

All of them must pass. Add or update tests for behaviour you change.

### Conventions

- Keep the SPDX licence header and copyright line at the top of source files.
- Write interface text in both languages with `t('中文','English')`; never translate user input or saved records.
- Never commit real client data, keys, host addresses, personal paths or runtime data.
- Describe the change and its reason in the pull request, and update the relevant manual in both `docs/CN` and `docs/English`.

### Licence of contributions

By submitting a contribution you agree that it is licensed under [GPL-3.0-only](LICENSE), the same licence as the project. Do not submit logos, artwork or other non-code assets unless you hold the rights and say so explicitly; original project assets are not open-licensed (see [LICENSE-ASSETS.md](LICENSE-ASSETS.md)).

## 中文

感谢你关注观隅鸮馆。

### 开发环境

```sh
npm ci
npm run dev
```

需要 Node.js 24。架构、环境变量与构建方式见[开发手册](docs/CN/开发手册.md)。

### 提交 Pull Request 之前

```sh
npm run typecheck
npx eslint .
npm run check
npm run test:team
npm run test:v3-workflow
npm run test:retention
```

以上全部通过后再提交。修改了哪些行为，就补充或更新对应的测试。

### 约定

- 源文件开头保留 SPDX 许可头与版权行。
- 界面文字用 `t('中文','English')` 同时写中英文；不要翻译用户输入或已保存的记录。
- 不要提交真实客户资料、密钥、主机地址、个人路径或运行数据。
- 在 Pull Request 中说明改了什么、为什么改，并同步更新 `docs/CN` 与 `docs/English` 中的相关手册。

### 贡献的授权

提交贡献即表示你同意以本项目相同的 [GPL-3.0-only](LICENSE) 授权你的贡献。除非你拥有相应权利并明确说明，请不要提交 Logo、插画等非代码素材；项目原创素材不开放授权，见 [LICENSE-ASSETS.md](LICENSE-ASSETS.md)。
