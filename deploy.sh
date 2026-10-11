#!/bin/bash
# 一键部署 luci-app-airoha-npu 到路由器（无需编译，直接推送源文件）
# 用法: ./deploy.sh [路由器IP] [用户名]
# 示例: ./deploy.sh 192.168.1.1 root

ROUTER="${1:-192.168.1.1}"
USER="${2:-root}"
TARGET="$USER@$ROUTER"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

echo "=== 部署 luci-app-airoha-npu ==="
echo "目标: $TARGET"
echo ""

# 检查 SSH 连通性
echo "[1/5] 检查连接..."
if ! ssh -o ConnectTimeout=5 -o BatchMode=yes "$TARGET" "echo ok" >/dev/null 2>&1; then
    echo "❌ 无法连接 $TARGET，请检查 IP 和 SSH 配置"
    exit 1
fi
echo "✅ 连接成功"

# 前端 JS
echo "[2/5] 推送前端 JS..."
scp "$SCRIPT_DIR/htdocs/luci-static/resources/view/airoha_npu/status.js" \
    "$TARGET:/www/luci-static/resources/view/airoha_npu/" || { echo "❌ JS 推送失败"; exit 1; }

# 后端 rpcd
echo "[3/5] 推送后端 rpcd..."
scp "$SCRIPT_DIR/root/usr/libexec/rpcd/luci.airoha_npu" \
    "$TARGET:/usr/libexec/rpcd/" || { echo "❌ rpcd 推送失败"; exit 1; }
ssh "$TARGET" chmod +x /usr/libexec/rpcd/luci.airoha_npu

# 菜单和权限（首次安装时需要，已安装则覆盖）
echo "[4/5] 推送菜单和权限配置..."
scp "$SCRIPT_DIR/root/usr/share/luci/menu.d/luci-app-airoha-npu.json" \
    "$TARGET:/usr/share/luci/menu.d/" 2>/dev/null
scp "$SCRIPT_DIR/root/usr/share/rpcd/acl.d/luci-app-airoha-npu.json" \
    "$TARGET:/usr/share/rpcd/acl.d/" 2>/dev/null

# 重启 rpcd
echo "[5/5] 重启 rpcd 服务..."
ssh "$TARGET" /etc/init.d/rpcd restart 2>/dev/null

echo ""
echo "✅ 部署完成！浏览器打开 http://$ROUTER/cgi-bin/luci/admin/status/airoha_npu"
echo "   提示: Ctrl+Shift+R 硬刷新以加载最新 JS"
