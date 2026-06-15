# OPC Bot

基于 Next.js 16 + AI SDK 构建的智能对话平台，支持多模型切换、OPC Agent 管理、实时流式响应等企业级功能。

## 功能特性

### 核心对话
- **多模型支持** — 支持 GLM、DeepSeek、Moonshot、OpenAI 等多种模型，可运行时切换
- **流式响应** — 实时流式输出 AI 回复，支持中途停止并持久化停止标记
- **思考模式** — 支持推理模型的 thinking/reasoning 可视化展示
- **消息编辑与重生成** — 可编辑历史消息并重新生成回复
- **附件上传** — 支持图片、PDF、文本等多种文件格式

### OPC Agent 系统
- **Agent 管理** — 创建、编辑、启用/停用自定义 Agent
- **分组分类** — 7 个业务域分组（法律合规、财税资本、核心战略等），带颜色标识
- **预设问题** — 每个 Agent 可配置专属预设问题，快速启动对话
- **延迟持久化** — 新建对话仅在发送第一条消息时写入数据库，避免空会话

### 性能优化
- **双层消息缓存** — 内存 Map + localStorage，刷新页面秒开
- **SWR 数据获取** — 按需请求，避免重复拉取
- **hover 预加载** — 鼠标悬停历史记录项时预取消息
- **虚拟滚动** — 30+ 条消息自动启用虚拟渲染，保持流畅
- **历史列表乐观更新** — 发送消息立即显示在侧边栏，无需等待 AI 回复
- **离线感知** — 网络断开时显示提示横幅

### 其他
- **暗色模式** — 跟随系统主题自动切换
- **聊天可见性** — 支持私密/公开切换
- **消息投票** — 对 AI 回复进行 👍/👎 评价
- **代码高亮** — Shiki 语法高亮，支持多种语言
- **数学公式** — KaTeX 渲染支持
- **Mermaid 图表** — 支持流程图、时序图等

## 技术栈

| 分类 | 技术 |
|------|------|
| 框架 | Next.js 16.2.0 + Turbopack |
| 语言 | TypeScript 5.x |
| UI | React 19 + shadcn/ui (Radix) + Tailwind CSS 4 |
| AI | AI SDK 6.x (`@ai-sdk/react`) |
| 状态 | SWR 2.x（数据获取）+ React Context（UI 状态） |
| 数据库 | PostgreSQL + Drizzle ORM |
| 认证 | Auth.js v5 (next-auth) |
| 动画 | Motion (framer-motion) |
| 虚拟滚动 | @tanstack/react-virtual |
| 代码编辑 | CodeMirror 6 + ProseMirror |
| 存储 | Vercel Blob（文件）+ Redis（限流） |
| 测试 | Playwright (E2E) |
| 包管理 | pnpm 10.x |

## 项目结构

```
opcbot/
├── app/
│   ├── (auth)/          # 认证模块（登录/注册/NextAuth）
│   └── (chat)/          # 聊天模块
│       ├── agents/      # OPC Agent 管理页面
│       ├── api/         # API 路由
│       │   ├── chat/    # 对话 API（流式、创建）
│       │   ├── history/ # 聊天历史列表
│       │   ├── messages/# 消息 CRUD
│       │   ├── agents/  # Agent CRUD
│       │   └── ...
│       └── chat/        # 聊天页面
├── components/
│   ├── ai-elements/     # AI 基础 UI（消息、代码块、推理）
│   ├── chat/            # 聊天功能组件（40+ 组件）
│   └── ui/              # shadcn/ui 基础组件
├── hooks/               # 自定义 Hooks
│   ├── use-active-chat  # 核心：消息状态、缓存同步、Agent 上下文
│   ├── use-message-cache# 双层消息缓存（内存 + localStorage）
│   ├── use-messages     # 滚动管理（自动滚底、位置追踪）
│   └── ...
├── lib/
│   ├── ai/              # AI 模型配置、系统提示词、工具定义
│   ├── db/              # Drizzle schema、数据库查询
│   ├── editor/          # ProseMirror 编辑器配置
│   └── ...
└── tests/               # E2E 测试
```

## 快速开始

### 环境要求

- Node.js 18+
- pnpm 10.x
- PostgreSQL 数据库
- Redis（可选，用于限流）

### 安装与运行

```bash
# 克隆项目
git clone <repo-url>
cd opcbot

# 安装依赖
pnpm install

# 配置环境变量
cp .env.example .env.local
# 编辑 .env.local 填入实际值

# 初始化数据库
pnpm db:migrate

# 启动开发服务器
pnpm dev
```

访问 [http://localhost:3000](http://localhost:3000)

### 环境变量

| 变量 | 说明 | 必填 |
|------|------|------|
| `AUTH_SECRET` | 认证密钥（`openssl rand -base64 32` 生成） | ✅ |
| `POSTGRES_URL` | PostgreSQL 连接字符串 | ✅ |
| `AI_GATEWAY_API_KEY` | AI Gateway API 密钥（非 Vercel 部署需要） | 视情况 |
| `BLOB_READ_WRITE_TOKEN` | Vercel Blob 存储令牌 | 可选 |
| `REDIS_URL` | Redis 连接字符串（用于限流） | 可选 |

### 常用脚本

```bash
pnpm dev          # 开发服务器（Turbopack）
pnpm build        # 生产构建
pnpm start        # 启动生产服务
pnpm db:studio    # 数据库可视化管理
pnpm db:generate  # 生成 Drizzle 迁移文件
pnpm db:migrate   # 执行数据库迁移
pnpm test         # 运行 E2E 测试
pnpm check        # 代码检查（Biome）
pnpm fix          # 自动修复代码风格
```

## 数据流架构

```
用户输入
  │
  ├─ 乐观更新 → 侧边栏历史列表立即显示
  │
  ├─ POST /api/chat → 流式响应
  │     │
  │     ├─ 服务端: 保存 user 消息 → 调用 AI → 流式返回
  │     └─ onFinish: 保存 assistant 消息 → 刷新历史
  │
  └─ 本地状态更新
        │
        ├─ useChat (React state) → UI 渲染
        ├─ rAF 去抖 → 内存缓存
        └─ localStorage 持久化（双层缓存）

页面导航
  │
  ├─ 缓存命中 → 跳过 API，直接使用本地数据
  └─ 缓存未命中 → SWR 请求 → 存入缓存
```

## 部署

### Vercel 一键部署

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/templates/next.js/chatbot)

### 手动部署

```bash
pnpm build
pnpm start
```

> **注意**：非 Vercel 环境需设置 `AI_GATEWAY_API_KEY` 环境变量。

## 许可证

MIT License
