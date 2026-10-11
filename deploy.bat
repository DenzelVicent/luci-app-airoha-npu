@echo off
chcp 65001 >nul 2>&1
echo === 部署 luci-app-airoha-npu ===
echo.

set ROUTER=%1
if "%ROUTER%"=="" set ROUTER=192.168.1.1

set USER=%2
if "%USER%"=="" set USER=root

echo 目标: %USER%@%ROUTER%
echo.

echo [1/5] 检查连接...
ssh -o ConnectTimeout=5 -o BatchMode=yes %USER%@%ROUTER% "echo ok" >nul 2>&1
if %errorlevel% neq 0 (
    echo X 无法连接 %USER%@%ROUTER%，请检查 IP 和 SSH 配置
    pause
    exit /b 1
)
echo OK 连接成功

echo [2/5] 推送前端 JS...
scp "%~dp0htdocs\luci-static\resources\view\airoha_npu\status.js" "%USER%@%ROUTER%:/www/luci-static/resources/view/airoha_npu/"
if %errorlevel% neq 0 ( echo X JS 推送失败 & pause & exit /b 1 )

echo [3/5] 推送后端 rpcd...
scp "%~dp0root\usr\libexec\rpcd\luci.airoha_npu" "%USER%@%ROUTER%:/usr/libexec/rpcd/"
if %errorlevel% neq 0 ( echo X rpcd 推送失败 & pause & exit /b 1 )
ssh %USER%@%ROUTER% chmod +x /usr/libexec/rpcd/luci.airoha_npu

echo [4/5] 推送菜单和权限配置...
scp "%~dp0root\usr\share\luci\menu.d\luci-app-airoha-npu.json" "%USER%@%ROUTER%:/usr/share/luci/menu.d/" 2>nul
scp "%~dp0root\usr\share\rpcd\acl.d\luci-app-airoha-npu.json" "%USER%@%ROUTER%:/usr/share/rpcd/acl.d/" 2>nul

echo [5/5] 重启 rpcd 服务...
ssh %USER%@%ROUTER% /etc/init.d/rpcd restart 2>nul

echo.
echo OK 部署完成！浏览器打开 http://%ROUTER%/cgi-bin/luci/admin/status/airoha_npu
echo    提示: Ctrl+Shift+R 硬刷新以加载最新 JS
pause
