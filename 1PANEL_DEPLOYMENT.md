# GitLab Webhook Server - 1Panel 部署指南

本指南说明如何将 GitLab Webhook Server 部署到 1Panel 面板。

## 前置要求

- ✅ 已安装 1Panel 面板
- ✅ 已安装 Docker 和 Docker Compose
- ✅ 已配置好 Mastra API 服务（可以是 Cloudflare Workers 或独立服务器）
- ✅ 拥有 GitLab Access Token 和钉钉 Webhook URL

## 部署架构

```
┌──────────────┐      Push Event     ┌─────────────────────┐     HTTP API      ┌──────────────────┐
│              │ ──────────────────>  │  Webhook Server     │ ───────────────>  │   Mastra API     │
│   GitLab     │                      │  (1Panel Docker)    │                   │   (Cloudflare    │
│              │                      │   Port 3000         │                   │    或独立服务器)  │
└──────────────┘                      └─────────────────────┘                   └──────────────────┘
```

## 方案一：使用 1Panel 的 Docker Compose 功能（推荐）

### 步骤 1: 准备项目文件

在你的服务器上创建项目目录：

```bash
# SSH 登录到服务器
ssh user@your-server

# 创建项目目录
mkdir -p /opt/gitlab-webhook-server
cd /opt/gitlab-webhook-server
```

### 步骤 2: 上传项目文件

将以下文件上传到服务器的 `/opt/gitlab-webhook-server` 目录：

- `Dockerfile`
- `docker-compose.yml`
- `.dockerignore`
- `package.json`
- `yarn.lock` 或 `package-lock.json`
- `tsconfig.json`
- `src/` 目录及其所有文件

可以使用 scp 或 rsync：

```bash
# 在本地机器执行
cd /path/to/gitlab-webhook-server
rsync -avz --exclude='node_modules' --exclude='.git' \
  ./ user@your-server:/opt/gitlab-webhook-server/
```

### 步骤 3: 创建环境变量文件

在服务器上创建 `.env` 文件：

```bash
cd /opt/gitlab-webhook-server
nano .env
```

填入以下内容（根据实际情况修改）：

```env
# 端口配置
PORT=3000

# Mastra API 服务地址
# 如果部署在 Cloudflare Workers：
MASTRA_API_URL=https://your-mastra-api.workers.dev
# 如果部署在同服务器：
# MASTRA_API_URL=http://localhost:4111

# GitLab 配置
GITLAB_URL=https://gitlab.com
GITLAB_ACCESS_TOKEN=glpat-xxxxxxxxxxxxxxxxxxxx
GITLAB_PROJECT_ID=12345
GITLAB_WEBHOOK_SECRET=your-webhook-secret-token

# 钉钉配置
DINGTALK_WEBHOOK_URL=https://oapi.dingtalk.com/robot/send?access_token=xxxxx
DINGTALK_SECRET=SECxxxxxxxxxxxxxxxxxxxxx
```

### 步骤 4: 使用 1Panel 部署

#### 4.1 打开 1Panel 面板

访问 1Panel 管理界面：`https://your-server:port`

#### 4.2 进入容器管理

1. 点击左侧菜单 **"容器"**
2. 选择 **"编排"** 标签页
3. 点击 **"创建编排"** 按钮

#### 4.3 配置编排项目

填写以下信息：

- **项目名称**: `gitlab-webhook-server`
- **项目路径**: `/opt/gitlab-webhook-server`
- **编排文件**: 选择 `docker-compose.yml`

#### 4.4 启动服务

1. 点击 **"创建"** 按钮
2. 返回编排列表，找到 `gitlab-webhook-server`
3. 点击 **"启动"** 按钮

#### 4.5 查看日志

在 1Panel 中：

1. 点击编排项目后的 **"详情"**
2. 选择 **"日志"** 标签页
3. 查看启动日志，确认服务正常运行

预期看到：

```
🚀 GitLab Webhook Server is running on port 3000
📝 Webhook endpoint: http://localhost:3000/webhook/gitlab
🔍 Health check: http://localhost:3000/health
🧪 Test Mastra API: http://localhost:3000/test/mastra-api
ℹ️  System info: http://localhost:3000/info

🌐 Mastra API URL: https://your-mastra-api.workers.dev
💡 确保 Mastra API 服务正在运行
```

### 步骤 5: 配置反向代理（可选）

如果需要通过域名访问，可以在 1Panel 中配置 Nginx 反向代理：

#### 5.1 在 1Panel 中添加网站

1. 点击左侧菜单 **"网站"**
2. 点击 **"创建网站"** 按钮
3. 选择 **"反向代理"**

#### 5.2 配置反向代理

填写信息：

- **主域名**: `webhook.yourdomain.com`
- **代理地址**: `http://localhost:3000`
- **启用 SSL**: 是（推荐使用 Let's Encrypt）

#### 5.3 保存并测试

保存配置后，访问：

```bash
https://webhook.yourdomain.com/health
```

应该返回健康检查信息。

### 步骤 6: 在 GitLab 中配置 Webhook

1. 登录 GitLab
2. 进入项目 → Settings → Webhooks
3. 填写信息：
   - **URL**: `https://webhook.yourdomain.com/webhook/gitlab`
   - **Secret Token**: 与 `.env` 中的 `GITLAB_WEBHOOK_SECRET` 一致
   - **Trigger**: 勾选 `Push events`
   - **Enable SSL verification**: 是
4. 点击 **"Add webhook"**
5. 点击 **"Test"** → **"Push events"** 测试

### 步骤 7: 测试完整流程

#### 7.1 推送代码测试

```bash
cd your-project
git add .
git commit -m "test: trigger webhook"
git push origin main
```

#### 7.2 查看日志

在 1Panel 容器日志中查看：

```
📥 收到 GitLab Webhook 请求
🔍 Headers: ...
📦 Body 概览: ...
🌐 调用远程 Mastra API: https://your-mastra-api.workers.dev/api/workflows/codeReviewWorkflow/execute
✅ Workflow 执行成功
```

#### 7.3 检查钉钉通知

在钉钉群中应该收到代码审查报告。

---

## 方案二：使用 1Panel 的应用商店（如果支持自定义应用）

### 步骤 1: 构建并推送镜像

```bash
# 在本地构建镜像
cd /path/to/gitlab-webhook-server
docker build -t your-registry/gitlab-webhook-server:latest .

# 推送到镜像仓库
docker push your-registry/gitlab-webhook-server:latest
```

### 步骤 2: 在 1Panel 中创建容器

1. 点击左侧菜单 **"容器"**
2. 选择 **"容器"** 标签页
3. 点击 **"创建容器"** 按钮

填写信息：

- **容器名称**: `gitlab-webhook-server`
- **镜像**: `your-registry/gitlab-webhook-server:latest`
- **端口映射**: `3000:3000`
- **环境变量**: 添加所有 `.env` 中的变量
- **重启策略**: `unless-stopped`

---

## 方案三：手动 Docker 命令部署

如果不使用 1Panel 界面，也可以通过 SSH 直接使用 Docker 命令：

```bash
# SSH 登录服务器
ssh user@your-server

# 进入项目目录
cd /opt/gitlab-webhook-server

# 构建镜像
docker build -t gitlab-webhook-server:latest .

# 使用 Docker Compose 启动
docker-compose up -d

# 查看日志
docker-compose logs -f

# 查看状态
docker-compose ps

# 停止服务
docker-compose down
```

---

## 监控和维护

### 健康检查

访问健康检查端点：

```bash
curl http://localhost:3000/health
```

或者通过域名：

```bash
curl https://webhook.yourdomain.com/health
```

预期响应：

```json
{
  "status": "ok",
  "timestamp": "2024-10-28T10:00:00.000Z",
  "service": "GitLab Webhook Server",
  "mastraApi": {
    "url": "https://your-mastra-api.workers.dev",
    "healthy": true
  }
}
```

### 测试 Mastra API 连接

```bash
curl http://localhost:3000/test/mastra-api
```

### 查看系统信息

```bash
curl http://localhost:3000/info
```

### 查看容器日志

在 1Panel 中：

1. 容器管理 → 编排
2. 找到 `gitlab-webhook-server`
3. 点击详情 → 日志

或者通过命令行：

```bash
docker-compose logs -f gitlab-webhook-server
```

### 重启服务

在 1Panel 中点击 **"重启"** 按钮，或者：

```bash
docker-compose restart
```

### 更新服务

当代码有更新时：

```bash
# 上传新代码
rsync -avz --exclude='node_modules' --exclude='.git' \
  ./ user@your-server:/opt/gitlab-webhook-server/

# SSH 登录服务器
ssh user@your-server
cd /opt/gitlab-webhook-server

# 重新构建并重启
docker-compose down
docker-compose build --no-cache
docker-compose up -d

# 查看日志确认
docker-compose logs -f
```

---

## 安全建议

### 1. 使用 HTTPS

- ✅ 在 1Panel 中配置 SSL 证书
- ✅ 启用 Let's Encrypt 自动续期
- ✅ 强制 HTTPS 重定向

### 2. 配置防火墙

只开放必要的端口：

```bash
# 如果使用反向代理，只需开放 443 和 80
ufw allow 80/tcp
ufw allow 443/tcp
ufw enable

# 如果直接暴露 3000 端口（不推荐）
ufw allow 3000/tcp
```

### 3. 限制访问

在 Nginx 反向代理中限制访问来源：

```nginx
location /webhook/gitlab {
    # 只允许 GitLab 的 IP 访问
    allow 34.74.90.64/28;  # GitLab.com IP 范围
    deny all;

    proxy_pass http://localhost:3000;
}
```

### 4. 保护环境变量

确保 `.env` 文件权限正确：

```bash
chmod 600 /opt/gitlab-webhook-server/.env
```

### 5. 定期更新

定期更新 Docker 镜像和依赖：

```bash
cd /opt/gitlab-webhook-server
docker-compose pull
docker-compose up -d
```

---

## 故障排查

### 问题 1: 容器启动失败

**症状**: 容器启动后立即退出

**解决方法**:

```bash
# 查看日志
docker-compose logs gitlab-webhook-server

# 检查环境变量
docker-compose config
```

### 问题 2: 无法连接到 Mastra API

**症状**: 日志显示 `无法连接到 Mastra API`

**解决方法**:

1. 检查 `MASTRA_API_URL` 是否正确
2. 测试网络连接：

```bash
docker exec gitlab-webhook-server curl https://your-mastra-api.workers.dev/health
```

3. 如果 Mastra API 在同服务器，检查 Docker 网络配置

### 问题 3: GitLab Webhook 调用失败

**症状**: GitLab 显示 webhook 失败

**解决方法**:

1. 检查防火墙是否允许 GitLab IP
2. 检查 SSL 证书是否有效
3. 查看 webhook 服务器日志
4. 在 GitLab 中查看 webhook 请求详情

### 问题 4: 钉钉通知未收到

**症状**: webhook 成功但钉钉没收到消息

**解决方法**:

1. 检查 `DINGTALK_WEBHOOK_URL` 和 `DINGTALK_SECRET` 是否正确
2. 测试钉钉 webhook：

```bash
curl -X POST "https://oapi.dingtalk.com/robot/send?access_token=xxx" \
  -H "Content-Type: application/json" \
  -d '{"msgtype":"text","text":{"content":"test"}}'
```

3. 查看 Mastra API 日志

---

## 性能优化

### 1. 资源限制

在 `docker-compose.yml` 中已配置：

- CPU: 最大 0.5 核心
- 内存: 最大 512MB

可根据实际情况调整。

### 2. 日志轮转

日志配置已设置：

- 单文件最大 10MB
- 保留最近 3 个文件

### 3. 监控

使用 1Panel 的监控功能查看：

- CPU 使用率
- 内存使用率
- 网络流量

---

## 成本估算

| 组件 | 配置 | 月成本 |
|------|------|--------|
| VPS 服务器 | 1核 1GB | ¥30-50 |
| 域名 | .com | ¥60/年 |
| SSL 证书 | Let's Encrypt | 免费 |
| **总计** | - | **¥30-50/月** |

如果 Mastra API 部署在 Cloudflare Workers（免费），总成本非常低。

---

## 备份和恢复

### 备份配置

```bash
# 备份环境变量和配置文件
cd /opt/gitlab-webhook-server
tar -czf backup-$(date +%Y%m%d).tar.gz \
  .env docker-compose.yml src/ package.json tsconfig.json

# 上传到远程
scp backup-*.tar.gz user@backup-server:/backups/
```

### 恢复配置

```bash
# 下载备份
scp user@backup-server:/backups/backup-20241028.tar.gz .

# 解压
tar -xzf backup-20241028.tar.gz

# 重新部署
docker-compose up -d
```

---

## 相关文档

- [项目主 README](README.md)
- [架构说明](../ARCHITECTURE.md)
- [Mastra API 部署指南](../gitlab-code-review/CLOUDFLARE_DEPLOYMENT.md)

---

## 支持

如有问题，请查看：

1. 容器日志：`docker-compose logs -f`
2. 健康检查：`curl http://localhost:3000/health`
3. Mastra API 测试：`curl http://localhost:3000/test/mastra-api`

---

**部署完成！现在你可以享受自动化的 AI 代码审查了！** 🎉
