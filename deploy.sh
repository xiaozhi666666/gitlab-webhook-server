#!/bin/bash

# GitLab Webhook Server - 快速部署脚本
# 适用于在服务器上快速部署到 1Panel 或直接使用 Docker Compose

set -e  # 遇到错误立即退出

echo "🚀 GitLab Webhook Server - 部署脚本"
echo "======================================"
echo ""

# 检查 Docker 是否安装
if ! command -v docker &> /dev/null; then
    echo "❌ 错误: Docker 未安装"
    echo "请先安装 Docker: https://docs.docker.com/get-docker/"
    exit 1
fi

# 检查 Docker Compose 是否安装
if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
    echo "❌ 错误: Docker Compose 未安装"
    echo "请先安装 Docker Compose"
    exit 1
fi

# 检查 .env 文件是否存在
if [ ! -f .env ]; then
    echo "⚠️  警告: .env 文件不存在"
    echo "📝 从模板创建 .env 文件..."

    if [ -f .env.example ]; then
        cp .env.example .env
        echo "✅ 已创建 .env 文件（从 .env.example 复制）"
        echo "⚠️  请编辑 .env 文件，填入正确的配置信息"
        echo ""
        read -p "是否现在编辑 .env 文件? (y/n) " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            ${EDITOR:-nano} .env
        else
            echo "请稍后手动编辑 .env 文件，然后重新运行此脚本"
            exit 1
        fi
    else
        echo "❌ 错误: .env.example 文件也不存在"
        echo "请创建 .env 文件并填入必要的环境变量"
        exit 1
    fi
fi

echo "✅ 环境检查通过"
echo ""

# 显示当前配置（隐藏敏感信息）
echo "📋 当前配置:"
echo "-----------------------------------"
source .env
echo "PORT: ${PORT:-3000}"
echo "MASTRA_API_URL: ${MASTRA_API_URL}"
echo "GITLAB_URL: ${GITLAB_URL}"
echo "GITLAB_PROJECT_ID: ${GITLAB_PROJECT_ID}"
echo "GITLAB_ACCESS_TOKEN: ${GITLAB_ACCESS_TOKEN:0:10}..."
echo "DINGTALK_WEBHOOK_URL: ${DINGTALK_WEBHOOK_URL:0:40}..."
echo "-----------------------------------"
echo ""

# 询问部署方式
echo "🔧 请选择部署方式:"
echo "1) 使用 Docker Compose 部署（推荐）"
echo "2) 仅构建 Docker 镜像"
echo "3) 构建并推送到镜像仓库"
echo "4) 停止并删除现有容器"
echo ""
read -p "请选择 (1-4): " -n 1 -r
echo
echo ""

case $REPLY in
    1)
        echo "🏗️  开始使用 Docker Compose 部署..."
        echo ""

        # 停止旧容器（如果存在）
        echo "🛑 停止旧容器（如果存在）..."
        docker-compose down || true

        # 构建镜像
        echo "🔨 构建 Docker 镜像..."
        docker-compose build --no-cache

        # 启动服务
        echo "🚀 启动服务..."
        docker-compose up -d

        # 等待服务启动
        echo "⏳ 等待服务启动..."
        sleep 5

        # 检查服务状态
        echo "📊 检查服务状态..."
        docker-compose ps

        echo ""
        echo "✅ 部署完成！"
        echo ""
        echo "📝 查看日志:"
        echo "   docker-compose logs -f"
        echo ""
        echo "🔍 健康检查:"
        echo "   curl http://localhost:${PORT:-3000}/health"
        echo ""
        echo "🧪 测试 Mastra API 连接:"
        echo "   curl http://localhost:${PORT:-3000}/test/mastra-api"
        echo ""

        # 询问是否查看日志
        read -p "是否查看实时日志? (y/n) " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            docker-compose logs -f
        fi
        ;;

    2)
        echo "🔨 构建 Docker 镜像..."
        docker build -t gitlab-webhook-server:latest .
        echo ""
        echo "✅ 镜像构建完成！"
        echo ""
        echo "镜像名称: gitlab-webhook-server:latest"
        echo ""
        echo "📝 运行容器:"
        echo "   docker run -d -p 3000:3000 --env-file .env gitlab-webhook-server:latest"
        ;;

    3)
        echo "请输入镜像仓库地址（例如: docker.io/username/gitlab-webhook-server）:"
        read REGISTRY_URL

        if [ -z "$REGISTRY_URL" ]; then
            echo "❌ 错误: 镜像仓库地址不能为空"
            exit 1
        fi

        echo ""
        echo "🔨 构建镜像..."
        docker build -t $REGISTRY_URL:latest .

        echo "📤 推送到镜像仓库..."
        docker push $REGISTRY_URL:latest

        echo ""
        echo "✅ 推送完成！"
        echo ""
        echo "镜像地址: $REGISTRY_URL:latest"
        ;;

    4)
        echo "🛑 停止并删除容器..."
        docker-compose down -v

        echo ""
        echo "✅ 清理完成！"
        ;;

    *)
        echo "❌ 无效选择"
        exit 1
        ;;
esac

echo ""
echo "🎉 完成！"
