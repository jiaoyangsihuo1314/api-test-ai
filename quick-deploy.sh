#!/bin/bash

# ================================
# API 智能测试平台 - 快速部署脚本
# ================================

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# 显示横幅
show_banner() {
    echo -e "${BLUE}"
    cat << "EOF"
    ___    ____   ______          __  __  ___           __
   /   |  /  _/  /_  __/__  _____/ /_/  |/  (_)___  ____/ /
  / /| |  / /     / / / _ \/ ___/ __/ /|_/ / / __ \/ __  / 
 / ___ |_/ /     / / /  __(__  ) /_/ /  / / / / / / /_/ /  
/_/  |_/___/    /_/  \___/____/\__/_/  /_/_/_/ /_/\__,_/   

EOF
    echo -e "${NC}"
    echo -e "${CYAN}AI-Powered Visual API Test Orchestration Platform${NC}"
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""
}

# 检查依赖
check_dependencies() {
    echo -e "${BLUE}📋 检查系统依赖...${NC}"
    
    # 检查 Docker
    if ! command -v docker &> /dev/null; then
        echo -e "${RED}❌ Docker 未安装${NC}"
        echo "请先安装 Docker: https://docs.docker.com/get-docker/"
        exit 1
    fi
    
    # 检查 Docker 是否运行
    if ! docker info &> /dev/null; then
        echo -e "${RED}❌ Docker 未运行${NC}"
        echo "请先启动 Docker"
        exit 1
    fi
    
    echo -e "${GREEN}✅ Docker 已就绪${NC}"
    
    # 检查 Docker Compose（可选）
    if command -v docker-compose &> /dev/null; then
        echo -e "${GREEN}✅ Docker Compose 已安装${NC}"
        USE_COMPOSE=true
    else
        echo -e "${YELLOW}⚠️  Docker Compose 未安装，将使用 docker run${NC}"
        USE_COMPOSE=false
    fi
    
    echo ""
}

# 选择镜像仓库
select_registry() {
    echo -e "${BLUE}📦 选择镜像仓库:${NC}"
    echo "  1) GitHub Container Registry (ghcr.io) - 推荐"
    echo "  2) Docker Hub (docker.io)"
    echo "  3) 自定义镜像地址"
    echo ""
    
    read -p "请选择 [1-3]: " registry_choice
    
    case $registry_choice in
        1)
            echo ""
            echo -e "${CYAN}请输入 GitHub 用户名或组织名:${NC}"
            read -p "GitHub Username: " github_user
            IMAGE="ghcr.io/${github_user}/aitestmind-all-in-one:latest"
            ;;
        2)
            echo ""
            echo -e "${CYAN}请输入 Docker Hub 用户名:${NC}"
            read -p "Docker Username: " docker_user
            IMAGE="${docker_user}/aitestmind-all-in-one:latest"
            ;;
        3)
            echo ""
            echo -e "${CYAN}请输入完整的镜像地址:${NC}"
            read -p "Image: " IMAGE
            ;;
        *)
            echo -e "${RED}❌ 无效的选择${NC}"
            exit 1
            ;;
    esac
    
    echo ""
    echo -e "${GREEN}📦 使用镜像: ${IMAGE}${NC}"
    echo ""
}

# 配置端口
configure_ports() {
    echo -e "${BLUE}🔧 端口配置${NC}"
    
    # 前端端口
    read -p "前端端口 [默认: 3000]: " frontend_port
    FRONTEND_PORT=${frontend_port:-3000}
    
    # 执行器端口
    read -p "执行器端口 [默认: 8001]: " executor_port
    EXECUTOR_PORT=${executor_port:-8001}
    
    # 代理端口
    read -p "代理端口 [默认: 8899]: " proxy_port
    PROXY_PORT=${proxy_port:-8899}
    
    echo ""
    echo -e "${GREEN}✅ 端口配置:${NC}"
    echo "  • 前端: ${FRONTEND_PORT}"
    echo "  • 执行器: ${EXECUTOR_PORT}"
    echo "  • 代理: ${PROXY_PORT} (mitmproxy API 采集)"
    echo ""
}

# 配置 AI 提供商
configure_ai() {
    echo -e "${BLUE}🤖 AI 提供商配置 (可选)${NC}"
    echo ""
    read -p "是否配置 AI 提供商？[y/N]: " config_ai
    
    AI_ENV=""
    
    if [[ $config_ai =~ ^[Yy]$ ]]; then
        echo ""
        echo "选择 AI 提供商:"
        echo "  1) OpenAI"
        echo "  2) DeepSeek"
        echo "  3) Claude"
        echo "  4) 跳过"
        echo ""
        read -p "请选择 [1-4]: " ai_choice
        
        case $ai_choice in
            1)
                read -p "OpenAI API Key: " openai_key
                read -p "OpenAI Base URL [默认: https://api.openai.com/v1]: " openai_url
                openai_url=${openai_url:-https://api.openai.com/v1}
                AI_ENV="-e OPENAI_API_KEY=$openai_key -e OPENAI_BASE_URL=$openai_url"
                ;;
            2)
                read -p "DeepSeek API Key: " deepseek_key
                AI_ENV="-e DEEPSEEK_API_KEY=$deepseek_key -e DEEPSEEK_BASE_URL=https://api.deepseek.com/v1"
                ;;
            3)
                read -p "Claude API Key: " claude_key
                AI_ENV="-e ANTHROPIC_API_KEY=$claude_key"
                ;;
            4)
                echo "跳过 AI 配置"
                ;;
        esac
    fi
    
    echo ""
}

# 创建目录
create_directories() {
    echo -e "${BLUE}📁 创建数据目录...${NC}"
    
    mkdir -p ./data
    mkdir -p ./logs
    
    echo -e "${GREEN}✅ 目录创建完成${NC}"
    echo ""
}

# 拉取镜像
pull_image() {
    echo -e "${BLUE}📥 拉取 Docker 镜像...${NC}"
    echo ""
    
    docker pull $IMAGE
    
    if [ $? -ne 0 ]; then
        echo ""
        echo -e "${RED}❌ 镜像拉取失败${NC}"
        echo "请检查:"
        echo "  1. 镜像地址是否正确"
        echo "  2. 是否需要登录 (私有镜像)"
        echo "  3. 网络连接是否正常"
        exit 1
    fi
    
    echo ""
    echo -e "${GREEN}✅ 镜像拉取成功${NC}"
    echo ""
}

# 停止旧容器
stop_old_container() {
    if docker ps -a | grep -q aitestmind-prod; then
        echo -e "${YELLOW}⏹️  停止旧容器...${NC}"
        docker stop aitestmind-prod > /dev/null 2>&1 || true
        docker rm aitestmind-prod > /dev/null 2>&1 || true
        echo -e "${GREEN}✅ 旧容器已停止${NC}"
        echo ""
    fi
}

# 使用 Docker Run 部署
deploy_with_docker_run() {
    echo -e "${BLUE}🚀 启动容器...${NC}"
    echo ""
    
    docker run -d \
        --name aitestmind-prod \
        -p ${FRONTEND_PORT}:3000 \
        -p ${EXECUTOR_PORT}:8001 \
        -p ${PROXY_PORT}:8899 \
        -e NODE_ENV=production \
        -e DATABASE_URL=file:/app/data/dev.db \
        -e EXECUTOR_URL=http://localhost:8001 \
        -e PYTHONUNBUFFERED=1 \
        $AI_ENV \
        -v $(pwd)/data:/app/data \
        -v $(pwd)/logs:/app/logs \
        --restart unless-stopped \
        $IMAGE
    
    if [ $? -ne 0 ]; then
        echo ""
        echo -e "${RED}❌ 容器启动失败${NC}"
        exit 1
    fi
    
    echo ""
    echo -e "${GREEN}✅ 容器启动成功${NC}"
}

# 使用 Docker Compose 部署
deploy_with_compose() {
    echo -e "${BLUE}📝 创建 docker-compose.yml...${NC}"
    
    cat > docker-compose.yml << EOF
version: '3.8'

services:
  aitestmind:
    image: $IMAGE
    container_name: aitestmind-prod
    ports:
      - "${FRONTEND_PORT}:3000"
      - "${EXECUTOR_PORT}:8001"
      - "${PROXY_PORT}:8899"
    environment:
      - NODE_ENV=production
      - DATABASE_URL=file:/app/data/dev.db
      - EXECUTOR_URL=http://localhost:8001
      - PYTHONUNBUFFERED=1
EOF

    if [ -n "$AI_ENV" ]; then
        # 解析 AI_ENV 并添加到 compose 文件
        echo "$AI_ENV" | sed 's/-e /      - /g' >> docker-compose.yml
    fi

    cat >> docker-compose.yml << EOF
    volumes:
      - ./data:/app/data
      - ./logs:/app/logs
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/api/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"
EOF

    echo ""
    echo -e "${BLUE}🚀 启动服务...${NC}"
    echo ""
    
    docker-compose up -d
    
    if [ $? -ne 0 ]; then
        echo ""
        echo -e "${RED}❌ 服务启动失败${NC}"
        exit 1
    fi
    
    echo ""
    echo -e "${GREEN}✅ 服务启动成功${NC}"
}

# 等待服务就绪
wait_for_service() {
    echo ""
    echo -e "${YELLOW}⏳ 等待服务启动...${NC}"
    
    max_attempts=30
    attempt=0
    
    while [ $attempt -lt $max_attempts ]; do
        if curl -f http://localhost:${FRONTEND_PORT}/api/health > /dev/null 2>&1; then
            echo ""
            echo -e "${GREEN}✅ 服务已就绪！${NC}"
            return 0
        fi
        
        echo -n "."
        sleep 2
        attempt=$((attempt + 1))
    done
    
    echo ""
    echo -e "${YELLOW}⚠️  服务启动超时，请检查日志${NC}"
}

# 显示部署信息
show_deployment_info() {
    echo ""
    echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${GREEN}🎉 API 智能测试平台 部署完成！${NC}"
    echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""
    echo -e "${BLUE}🌐 访问地址：${NC}"
    echo "  • 前端界面: ${CYAN}http://localhost:${FRONTEND_PORT}${NC}"
    echo "  • 执行器API: ${CYAN}http://localhost:${EXECUTOR_PORT}${NC}"
    echo "  • API文档: ${CYAN}http://localhost:${EXECUTOR_PORT}/docs${NC}"
    echo "  • 代理端口: ${CYAN}localhost:${PROXY_PORT}${NC} (mitmproxy API 采集)"
    echo ""
    echo -e "${BLUE}📊 实用命令：${NC}"
    
    if [ "$USE_COMPOSE" = true ]; then
        echo "  • 查看日志: ${YELLOW}docker-compose logs -f${NC}"
        echo "  • 停止服务: ${YELLOW}docker-compose down${NC}"
        echo "  • 重启服务: ${YELLOW}docker-compose restart${NC}"
    else
        echo "  • 查看日志: ${YELLOW}docker logs -f aitestmind-prod${NC}"
        echo "  • 停止容器: ${YELLOW}docker stop aitestmind-prod${NC}"
        echo "  • 重启容器: ${YELLOW}docker restart aitestmind-prod${NC}"
    fi
    
    echo ""
    echo -e "${BLUE}📁 数据目录：${NC}"
    echo "  • 数据库: $(pwd)/data/dev.db"
    echo "  • 日志: $(pwd)/logs/"
    echo ""
    echo -e "${BLUE}📖 更多信息：${NC}"
    echo "  • 部署指南: ${CYAN}docs/deployment/DEPLOYMENT_GUIDE.md${NC}"
    echo "  • 用户文档: ${CYAN}docs/user-guide/${NC}"
    echo ""
    echo -e "${GREEN}✨ 祝你使用愉快！${NC}"
    echo ""
}

# 主函数
main() {
    show_banner
    check_dependencies
    select_registry
    configure_ports
    configure_ai
    create_directories
    pull_image
    stop_old_container
    
    if [ "$USE_COMPOSE" = true ]; then
        deploy_with_compose
    else
        deploy_with_docker_run
    fi
    
    wait_for_service
    show_deployment_info
}

# 运行主函数
main

