/**
 * GitLab Webhook Server
 *
 * 独立的 webhook 接收服务器，通过 HTTP 调用远程 Mastra API 服务
 *
 * 架构：GitLab Webhook → 本地 Express Server → 远程 Mastra API
 */

import 'dotenv/config';
import express from 'express';

const app = express();
app.use(express.json());

// Mastra API 服务地址（可以是本地或远程）
const MASTRA_API_URL = process.env.MASTRA_API_URL || 'http://localhost:4111';

// GitLab Code Review Webhook Endpoint
app.post('/webhook/gitlab', async (req, res) => {
  try {
    console.log('📥 收到 GitLab Webhook 请求');
    console.log('🔍 Headers:', JSON.stringify({
      'x-gitlab-event': req.headers['x-gitlab-event'],
      'x-gitlab-token': req.headers['x-gitlab-token'] ? '***' : 'missing',
      'content-type': req.headers['content-type']
    }, null, 2));
    console.log('📦 Body 概览:', JSON.stringify({
      object_kind: req.body.object_kind,
      ref: req.body.ref,
      project_name: req.body.project?.name,
      commits_count: req.body.commits?.length
    }, null, 2));

    // 验证必要的环境变量
    if (!process.env.GITLAB_ACCESS_TOKEN) {
      return res.status(400).json({ error: 'GITLAB_ACCESS_TOKEN 未配置' });
    }
    if (!process.env.DINGTALK_WEBHOOK_URL) {
      return res.status(400).json({ error: 'DINGTALK_WEBHOOK_URL 未配置' });
    }
    if (!process.env.GITLAB_PROJECT_ID) {
      return res.status(400).json({ error: 'GITLAB_PROJECT_ID 未配置' });
    }

    // 调用远程 Mastra API 执行 workflow
    console.log(`🌐 调用远程 Mastra API: ${MASTRA_API_URL}/api/workflows/codeReviewWorkflow/execute`);

    const mastraResponse = await fetch(`${MASTRA_API_URL}/api/workflows/codeReviewWorkflow/execute`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        triggerData: {
          headers: req.headers,
          body: req.body,
          secretToken: process.env.GITLAB_WEBHOOK_SECRET,
          gitlabUrl: process.env.GITLAB_URL || 'https://gitlab.com',
          accessToken: process.env.GITLAB_ACCESS_TOKEN,
          projectId: parseInt(process.env.GITLAB_PROJECT_ID),
          dingtalkWebhook: process.env.DINGTALK_WEBHOOK_URL,
          dingtalkSecret: process.env.DINGTALK_SECRET,
        }
      }),
    });

    if (!mastraResponse.ok) {
      const errorText = await mastraResponse.text();
      console.error('❌ Mastra API 调用失败:', mastraResponse.status, errorText);
      return res.status(500).json({
        success: false,
        message: `Mastra API 调用失败: ${mastraResponse.status} ${errorText}`,
      });
    }

    const result: any = await mastraResponse.json();
    console.log('✅ Workflow 执行成功:', result);

    res.json({
      success: result.success || true,
      message: result.message || '代码审查完成',
      reviewCount: result.reviewCount || 0,
      source: 'remote-mastra-api',
    });

  } catch (error: any) {
    console.error('❌ Webhook 处理失败:', error.message);
    res.status(500).json({
      success: false,
      message: `处理失败: ${error.message}`,
    });
  }
});

// 健康检查端点
app.get('/health', async (req, res) => {
  try {
    // 检查远程 Mastra API 是否可用
    const mastraHealth = await fetch(`${MASTRA_API_URL}/health`, {
      method: 'GET',
    }).then(r => r.ok).catch(() => false);

    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      service: 'GitLab Webhook Server',
      mastraApi: {
        url: MASTRA_API_URL,
        healthy: mastraHealth,
      },
    });
  } catch (error: any) {
    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      service: 'GitLab Webhook Server',
      mastraApi: {
        url: MASTRA_API_URL,
        healthy: false,
        error: error.message,
      },
    });
  }
});

// 测试 Mastra API 连接
app.get('/test/mastra-api', async (req, res) => {
  try {
    console.log(`🧪 测试 Mastra API 连接: ${MASTRA_API_URL}`);

    // 测试 Swagger UI
    const swaggerResponse = await fetch(`${MASTRA_API_URL}/swagger-ui`);
    const hasSwagger = swaggerResponse.ok;

    // 获取 workflows 列表
    const workflowsResponse = await fetch(`${MASTRA_API_URL}/api/workflows`);
    const workflows = workflowsResponse.ok ? await workflowsResponse.json() : null;

    // 获取 agents 列表
    const agentsResponse = await fetch(`${MASTRA_API_URL}/api/agents`);
    const agents = agentsResponse.ok ? await agentsResponse.json() : null;

    res.json({
      success: true,
      mastraApiUrl: MASTRA_API_URL,
      swagger: hasSwagger ? `${MASTRA_API_URL}/swagger-ui` : 'Not available',
      workflows: workflows || 'Could not fetch',
      agents: agents || 'Could not fetch',
    });
  } catch (error: any) {
    console.error('❌ Mastra API 连接测试失败:', error.message);
    res.status(500).json({
      success: false,
      message: `无法连接到 Mastra API: ${error.message}`,
      mastraApiUrl: MASTRA_API_URL,
      hint: '请确保 Mastra API 服务正在运行 (npm run dev)',
    });
  }
});

// 系统信息
app.get('/info', (req, res) => {
  res.json({
    service: 'GitLab Webhook Server',
    version: '1.0.0',
    description: '接收 GitLab webhook 并通过 HTTP 调用远程 Mastra API 服务',
    mastraApiUrl: MASTRA_API_URL,
    architecture: 'GitLab Webhook → Express Server → Remote Mastra API',
    endpoints: [
      'POST /webhook/gitlab',
      'GET /health',
      'GET /test/mastra-api',
      'GET /info'
    ],
    repository: 'https://github.com/your-username/gitlab-webhook-server',
  });
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`🚀 GitLab Webhook Server is running on port ${PORT}`);
  console.log(`📝 Webhook endpoint: http://localhost:${PORT}/webhook/gitlab`);
  console.log(`🔍 Health check: http://localhost:${PORT}/health`);
  console.log(`🧪 Test Mastra API: http://localhost:${PORT}/test/mastra-api`);
  console.log(`ℹ️  System info: http://localhost:${PORT}/info`);
  console.log('');
  console.log(`🌐 Mastra API URL: ${MASTRA_API_URL}`);
  console.log(`💡 确保 Mastra API 服务正在运行`);
});

export default app;
