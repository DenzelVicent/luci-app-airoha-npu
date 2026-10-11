#!/bin/bash
# 一键部署 luci-app-airoha-npu 到路由器（无需编译，直接推送源文件）
# 使用 SSH ControlMaster 复用连接（只需输入一次密码）
# 使用 ssh+cat+tr 传文件（tr 去除 CRLF，兼容 Dropbear）
# 用法: ./scp_deploy.sh [路由器IP] [用户名]
# 示例: ./scp_deploy.sh 192.168.1.1 root

ROUTER="${1:-192.168.1.1}"
USER="${2:-root}"
TARGET="$USER@$ROUTER"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

# SSH ControlMaster: 首次连接输入密码后，后续连接复用（10分钟超时）
CTRL_DIR="${TMPDIR:-/tmp}/luci-deploy-$$"
mkdir -p "$CTRL_DIR"
CTRL_SOCK="$CTRL_DIR/ssh.sock"
SSH_OPTS="-o ControlMaster=auto -o ControlPath=$CTRL_SOCK -o ControlPersist=600 -o ConnectTimeout=10"

cleanup() {
    ssh $SSH_OPTS -O exit "$TARGET" 2>/dev/null
    rm -rf "$CTRL_DIR"
}
trap cleanup EXIT

# 通过 ssh+cat 推送文件，tr 去除 CRLF 行尾（避免 Windows 行尾损坏 shell 脚本）
push_file() {
    local src="$1" dst="$2"
    if [ ! -f "$src" ]; then
        echo "  ⚠ 源文件不存在: $src"
        return 1
    fi
    ssh $SSH_OPTS "$TARGET" "tr -d '\r' > '$dst'" < "$src"
}

echo "=== 部署 luci-app-airoha-npu ==="
echo "目标: $TARGET"
echo ""

# 首次连接（需要输入密码，后续连接自动复用）
echo "[1/5] 建立连接（可能需要输入密码）..."
if ! ssh $SSH_OPTS "$TARGET" "echo ok" >/dev/null 2>&1; then
    echo "❌ 无法连接 $TARGET，请检查 IP 和 SSH 配置"
    exit 1
fi
echo "✅ 连接成功（后续操作无需再输入密码）"

# 前端 JS
echo "[2/5] 推送前端 JS..."
push_file "$SCRIPT_DIR/htdocs/luci-static/resources/view/airoha_npu/status.js" \
    "/www/luci-static/resources/view/airoha_npu/status.js" || { echo "❌ JS 推送失败"; exit 1; }
echo "  ✅ status.js"

# 后端 rpcd（tr 去除 CRLF 确保 shell 脚本不被损坏）
echo "[3/5] 推送后端 rpcd..."
push_file "$SCRIPT_DIR/root/usr/libexec/rpcd/luci.airoha_npu" \
    "/usr/libexec/rpcd/luci.airoha_npu" || { echo "❌ rpcd 推送失败"; exit 1; }
ssh $SSH_OPTS "$TARGET" "chmod +x /usr/libexec/rpcd/luci.airoha_npu"
echo "  ✅ luci.airoha_npu"

# 菜单和权限（首次安装时需要，确保目录存在）
echo "[4/5] 推送菜单和权限配置..."
ssh $SSH_OPTS "$TARGET" "mkdir -p /usr/share/luci/menu.d /usr/share/rpcd/acl.d"
push_file "$SCRIPT_DIR/root/usr/share/luci/menu.d/luci-app-airoha-npu.json" \
    "/usr/share/luci/menu.d/luci-app-airoha-npu.json" && echo "  ✅ menu.d" || echo "  ⚠ menu.d 推送失败"
push_file "$SCRIPT_DIR/root/usr/share/rpcd/acl.d/luci-app-airoha-npu.json" \
    "/usr/share/rpcd/acl.d/luci-app-airoha-npu.json" && echo "  ✅ acl.d" || echo "  ⚠ acl.d 推送失败"

# 重启 rpcd（让新后端和 ACL 生效）
echo "[5/5] 重启 rpcd 服务..."
ssh $SSH_OPTS "$TARGET" "/etc/init.d/rpcd restart" 2>/dev/null
sleep 1
echo "  ✅ rpcd 已重启"

echo ""
echo "✅ 部署完成！浏览器打开 http://$ROUTER/cgi-bin/luci/admin/status/airoha_npu"
echo "   提示: Ctrl+Shift+R 硬刷新以加载最新 JS"
