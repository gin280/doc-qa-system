#!/bin/bash
echo "=== 检查代理配置 ==="
echo "系统HTTP代理: ${HTTP_PROXY:-未设置}"
echo "系统HTTPS代理: ${HTTPS_PROXY:-未设置}"
echo ""
echo "=== 测试GitHub连接 ==="
if [ -n "$HTTPS_PROXY" ]; then
    echo "使用代理: $HTTPS_PROXY"
    curl -I https://github.com --max-time 5 --proxy "$HTTPS_PROXY"
else
    echo "未配置代理，直接连接..."
    curl -I https://github.com --max-time 5
fi
