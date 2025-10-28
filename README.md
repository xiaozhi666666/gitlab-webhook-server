# GitLab Webhook Server

独立的 GitLab Webhook 接收服务器，通过 HTTP 调用远程 Mastra API 服务进行代码审查。

## 架构

```
┌─────────────┐       HTTP Webhook      ┌────────────────────┐       HTTP API       ┌─────────────────┐
│   GitLab    │ ────────────────────>   │  Webhook Server    │ ──────────────────>  │  Mastra API     │
│             │                          │  (本项目)          │                      │  (独立服务)      │
└─────────────┘                          └────────────────────┘                      └─────────────────┘
                                                ↓                                             ↓
                                          接收 webhook                               AI 代码审查
                                          转发请求                                   + 钉钉通知
```

## 功能特性

- 🔄 **接收 GitLab Webhook**: 处理 GitLab push 事件
- 🌐 **远程 API 调用**: 通过 HTTP 调用远程 Mastra API 服务
- 🔍 **健康检查**: 提供服务状态和 Mastra API 连接状态
- 🧪 **连接测试**: 测试与 Mastra API 的连接
- 📊 **轻量级**: 无需安装 Mastra 依赖，仅需 Express

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 配置环境变量

复制环境变量模板：

```bash
cp .env.example .env
```

编辑 `.env` 文件：

```env
# 服务器端口
PORT=3000

# Mastra API 地址（本地或远程）
MASTRA_API_URL=http://localhost:4111  # 本地开发
# MASTRA_API_URL=https://your-mastra-api.workers.dev  # Cloudflare Workers
# MASTRA_API_URL=https://your-server.com:4111  # 独立服务器

# GitLab 配置
GITLAB_URL=https://gitlab.com
GITLAB_ACCESS_TOKEN=glpat-xxxxxxxxxxxxxxxxxxxx
GITLAB_PROJECT_ID=12345
GITLAB_WEBHOOK_SECRET=your_webhook_secret

# 钉钉配置
DINGTALK_WEBHOOK_URL=https://oapi.dingtalk.com/robot/send?access_token=xxx
DINGTALK_SECRET=your_dingtalk_secret
```

### 3. 启动服务

```bash
# 开发模式（自动重启）
npm run dev

# 生产模式
npm run build
npm start
```

服务将运行在 `http://localhost:3000`

### 4. 测试连接

```bash
# 健康检查
curl http://localhost:3000/health

# 测试 Mastra API 连接
curl http://localhost:3000/test/mastra-api

# 系统信息
curl http://localhost:3000/info
```

## API 端点

| 端点 | 方法 | 说明 |
|------|------|------|
| `/webhook/gitlab` | POST | 接收 GitLab webhook 事件 |
| `/health` | GET | 健康检查（包含 Mastra API 状态） |
| `/test/mastra-api` | GET | 测试 Mastra API 连接 |
| `/info` | GET | 系统信息 |

## 部署指南

### 本地开发

```bash
# 终端 1: 启动 Mastra API（在另一个项目目录）
cd ../gitlab-code-review
npm run dev  # Mastra API 运行在 4111 端口

# 终端 2: 启动 Webhook Server
cd ../gitlab-webhook-server
npm run dev  # Webhook Server 运行在 3000 端口
```

### 生产环境部署

#### 🚀 选项 1：部署到 1Panel（推荐）

**1Panel 是一款现代化的 Linux 服务器管理面板，支持 Docker 和 Docker Compose。**

详细步骤请查看：**[1Panel 部署指南](./1PANEL_DEPLOYMENT.md)**

快速部署：

```bash
# 1. 上传项目到服务器
rsync -avz --exclude='node_modules' --exclude='.git' \
  ./ user@your-server:/opt/gitlab-webhook-server/

# 2. SSH 登录服务器
ssh user@your-server
cd /opt/gitlab-webhook-server

# 3. 配置环境变量
cp .env.example .env
nano .env  # 编辑配置

# 4. 使用快速部署脚本
chmod +x deploy.sh
./deploy.sh

# 或者手动使用 Docker Compose
docker-compose up -d

# 5. 在 1Panel 中管理
# 打开 1Panel → 容器 → 编排 → 查看 gitlab-webhook-server
```

**优势**：
- ✅ 可视化管理容器
- ✅ 一键启动/停止/重启
- ✅ 实时查看日志
- ✅ 配置反向代理和 SSL 证书
- ✅ 资源监控

---

#### 选项 2：使用 Docker Compose（手动）

```bash
# 1. 克隆项目
git clone https://github.com/your-username/gitlab-webhook-server.git
cd gitlab-webhook-server

# 2. 配置环境变量
cp .env.example .env
# 编辑 .env，设置 MASTRA_API_URL 指向你的 Mastra API 服务

# 3. 启动服务
docker-compose up -d

# 4. 查看日志
docker-compose logs -f

# 5. 查看状态
docker-compose ps

# 6. 停止服务
docker-compose down
```

---

#### 选项 3：部署到 VPS/云服务器

```bash
# 1. 克隆项目
git clone https://github.com/your-username/gitlab-webhook-server.git
cd gitlab-webhook-server

# 2. 安装依赖
npm install

# 3. 配置环境变量
cp .env.example .env
# 编辑 .env，设置 MASTRA_API_URL 指向你的 Mastra API 服务

# 4. 构建
npm run build

# 5. 使用 PM2 启动
npm install -g pm2
pm2 start npm --name webhook-server -- start
pm2 save
pm2 startup
```

---

#### 选项 4：使用 Docker（单容器）

```bash
# 构建镜像
docker build -t gitlab-webhook-server .

# 运行容器
docker run -d \
  --name webhook-server \
  -p 3000:3000 \
  --env-file .env \
  --restart unless-stopped \
  gitlab-webhook-server

# 查看日志
docker logs -f webhook-server
```

---

#### 选项 5：部署到 Heroku

```bash
# 创建 Heroku 应用
heroku create your-webhook-server

# 设置环境变量
heroku config:set MASTRA_API_URL=https://your-mastra-api.workers.dev
heroku config:set GITLAB_ACCESS_TOKEN=your_token
# ... 其他环境变量

# 部署
git push heroku main
```

### 配置 GitLab Webhook

在 GitLab 项目设置中添加 webhook：

1. 进入 **Settings > Webhooks**
2. 配置：
   - **URL**: `https://your-server.com/webhook/gitlab`
   - **Secret Token**: 你的 `GITLAB_WEBHOOK_SECRET`
   - **Trigger events**: 勾选 "Push events"
   - **SSL verification**: 启用
3. 点击 **Add webhook**
4. 点击 **Test > Push events** 测试

## Mastra API 部署

Webhook Server 需要连接到 Mastra API 服务。你可以：

### 选项 1：本地运行 Mastra API

```bash
cd gitlab-code-review
npm run dev  # 运行在 http://localhost:4111
```

然后设置环境变量：
```env
MASTRA_API_URL=http://localhost:4111
```

### 选项 2：将 Mastra 部署到 Cloudflare Workers

Mastra 项目支持直接通过 GitHub 部署到 Cloudflare Workers：

1. **Fork/Push Mastra 项目到 GitHub**

2. **在 Cloudflare Dashboard 中创建 Worker**：
   - 登录 [Cloudflare Dashboard](https://dash.cloudflare.com/)
   - 进入 **Workers & Pages**
   - 点击 **Create Application**
   - 选择 **Create Worker**

3. **配置 GitHub 集成**：
   - 连接你的 GitHub 仓库
   - 选择 Mastra 项目
   - 配置构建命令：`npm install && npm run build`
   - 设置输出目录：`.mastra/output`

4. **配置环境变量**：
   在 Cloudflare Workers 设置中添加：
   ```
   OPENAI_API_KEY=sk-xxx
   ```

5. **部署完成后获取 Worker URL**：
   ```
   https://your-mastra-api.workers.dev
   ```

6. **更新 Webhook Server 环境变量**：
   ```env
   MASTRA_API_URL=https://your-mastra-api.workers.dev
   ```

### 选项 3：部署到独立服务器

```bash
# 在服务器上克隆 Mastra 项目
git clone https://github.com/your-username/gitlab-code-review.git
cd gitlab-code-review

# 安装依赖
npm install --legacy-peer-deps

# 配置环境变量
cp .env.example .env
# 编辑 .env

# 启动 Mastra API
npm run dev  # 开发环境
# 或
pm2 start "npm run dev" --name mastra-api  # 生产环境
```

然后设置 Webhook Server 的环境变量：
```env
MASTRA_API_URL=https://your-server.com:4111
```

## 环境变量说明

| 变量名 | 必填 | 默认值 | 说明 |
|--------|------|--------|------|
| `PORT` | 否 | `3000` | Webhook Server 端口 |
| `MASTRA_API_URL` | 否 | `http://localhost:4111` | Mastra API 服务地址 |
| `GITLAB_URL` | 否 | `https://gitlab.com` | GitLab 实例 URL |
| `GITLAB_ACCESS_TOKEN` | 是 | - | GitLab Access Token |
| `GITLAB_PROJECT_ID` | 是 | - | GitLab 项目 ID |
| `GITLAB_WEBHOOK_SECRET` | 否 | - | Webhook 验证密钥 |
| `DINGTALK_WEBHOOK_URL` | 是 | - | 钉钉机器人 Webhook URL |
| `DINGTALK_SECRET` | 否 | - | 钉钉加签密钥 |

## 故障排除

### 1. 无法连接到 Mastra API

**错误**: `无法连接到 Mastra API: ECONNREFUSED`

**解决**:
```bash
# 检查 Mastra API 是否运行
curl http://localhost:4111/health

# 检查环境变量
echo $MASTRA_API_URL

# 测试连接
curl http://localhost:3000/test/mastra-api
```

### 2. Webhook 接收失败

**检查**:
- GitLab webhook 配置是否正确
- Secret Token 是否匹配
- 防火墙是否开放端口
- 查看服务器日志：`npm run dev`

### 3. Mastra API 调用失败

**检查**:
- Mastra API 是否正常运行
- 环境变量是否正确配置
- 查看 Mastra API 日志

## 监控和日志

### 查看日志

```bash
# 开发模式（实时日志）
npm run dev

# PM2 管理的服务
pm2 logs webhook-server
pm2 logs webhook-server --lines 100
```

### 健康检查

定期检查服务状态：

```bash
# 检查 Webhook Server
curl http://localhost:3000/health

# 检查 Mastra API 连接
curl http://localhost:3000/test/mastra-api
```

## 项目结构

```
gitlab-webhook-server/
├── src/
│   └── index.ts          # 主服务器文件
├── dist/                 # 构建输出目录
├── .env.example          # 环境变量模板
├── .gitignore
├── package.json
├── tsconfig.json
└── README.md
```

## 开发

### 添加新端点

在 `src/index.ts` 中添加新的路由：

```typescript
app.get('/your-endpoint', (req, res) => {
  res.json({ message: 'Your response' });
});
```

### 自定义 Webhook 处理

修改 `src/index.ts` 中的 `/webhook/gitlab` 路由逻辑。

## 相关项目

- [gitlab-code-review](../gitlab-code-review) - Mastra API 服务（代码审查引擎）

## 许可证

MIT

## 贡献

欢迎提交 Issues 和 Pull Requests！
