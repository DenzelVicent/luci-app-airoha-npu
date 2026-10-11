# 一键部署 luci-app-airoha-npu 到路由器（PowerShell 原生脚本）
# 用法: .\deploy.ps1 [路由器IP] [用户名]
# 示例: .\deploy.ps1 192.168.1.1 root

param(
    [string]$Router = "192.168.1.1",
    [string]$User = "root"
)

$ErrorActionPreference = "Stop"
$Target = "$User@$Router"
$ScriptDir = $PSScriptRoot

Write-Host "=== 部署 luci-app-airoha-npu ===" -ForegroundColor Cyan
Write-Host "目标: $Target"
Write-Host ""

# 检查 SSH
Write-Host "[1/5] 检查连接..." -NoNewline
try {
    $null = ssh -o ConnectTimeout=5 $Target "echo ok" 2>&1
    Write-Host " OK" -ForegroundColor Green
} catch {
    Write-Host " FAIL" -ForegroundColor Red
    Write-Host "无法连接 $Target，请检查 IP 和 SSH 配置" -ForegroundColor Red
    exit 1
}

# 前端 JS
Write-Host "[2/5] 推送前端 JS..." -NoNewline
$jsSrc = Join-Path $ScriptDir "htdocs\luci-static\resources\view\airoha_npu\status.js"
scp $jsSrc "$Target`:/www/luci-static/resources/view/airoha_npu/" 2>&1 | Out-Null
if ($LASTEXITCODE -ne 0) { Write-Host " FAIL" -ForegroundColor Red; exit 1 }
Write-Host " OK" -ForegroundColor Green

# 后端 rpcd
Write-Host "[3/5] 推送后端 rpcd..." -NoNewline
$rpcdSrc = Join-Path $ScriptDir "root\usr\libexec\rpcd\luci.airoha_npu"
scp $rpcdSrc "$Target`:/usr/libexec/rpcd/" 2>&1 | Out-Null
if ($LASTEXITCODE -ne 0) { Write-Host " FAIL" -ForegroundColor Red; exit 1 }
ssh $Target "chmod +x /usr/libexec/rpcd/luci.airoha_npu" 2>&1 | Out-Null
Write-Host " OK" -ForegroundColor Green

# 菜单和权限
Write-Host "[4/5] 推送菜单和权限配置..." -NoNewline
$menuSrc = Join-Path $ScriptDir "root\usr\share\luci\menu.d\luci-app-airoha-npu.json"
$aclSrc = Join-Path $ScriptDir "root\usr\share\rpcd\acl.d\luci-app-airoha-npu.json"
scp $menuSrc "$Target`:/usr/share/luci/menu.d/" 2>$null
scp $aclSrc "$Target`:/usr/share/rpcd/acl.d/" 2>$null
Write-Host " OK" -ForegroundColor Green

# 重启 rpcd
Write-Host "[5/5] 重启 rpcd 服务..." -NoNewline
ssh $Target "/etc/init.d/rpcd restart" 2>$null | Out-Null
Write-Host " OK" -ForegroundColor Green

Write-Host ""
Write-Host "部署完成！浏览器打开:" -ForegroundColor Green
Write-Host "  http://$Router/cgi-bin/luci/admin/status/airoha_npu" -ForegroundColor Yellow
Write-Host "提示: Ctrl+Shift+R 硬刷新以加载最新 JS" -ForegroundColor Gray
