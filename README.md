# luci-app-airoha-npu

Airoha AN7581 SoC 实时监测与管理面板，适用于 OpenWrt。涵盖 NPU 卸载、CPU 频率、Frame Engine 内部状态及 PPE 流表。

**[下载](https://github.com/luanmuc/luci-app-airoha-npu/releases/latest)**

![License](https://img.shields.io/badge/license-Apache--2.0-blue.svg)
![OpenWrt](https://img.shields.io/badge/OpenWrt-24.10%2B-brightgreen.svg)
![Version](https://img.shields.io/badge/version-1.2.1-orange.svg)

## 界面截图

### CPU 频率与超频
![CPU 频率](screenshots/cpu-frequency.png)

### NPU 与卸载引擎
![NPU 与卸载引擎](screenshots/npu-offload-engine.png)

### PPE 流卸载表
![PPE 流表](screenshots/ppe-flow-table.png)

## 功能特性

### CPU 频率管理
- 当前频率显示（可视化柱状图）
- 调度策略选择（performance、ondemand、schedutil 等）
- 从可用 OPP 条目中选择最大频率
- 直接 PLL 超频控制（500-1600 MHz），通过硬件寄存器编程实现
- 超频检测与不稳定频率警告

### NPU 与卸载引擎
- NPU 固件版本（TLB 格式）、时钟频率、核心数
- NPU 负载状态（活跃/非活跃）及保留内存区域
- PPE 流卸载摘要（已绑定 / 总条目数）

### Frame Engine 可视化
- **PSE 共享缓冲区** 使用率指示条（拥塞指标）
- **GDM 端口卡片**，实时显示 TX/RX 数据包计数与丢包数：
  - GDM1：内部交换机（1G LAN3/4）
  - GDM2：WAN（USXGMII 10G）
  - GDM4：LAN2（USXGMII 10G）
- **CDM 卸载比率** 指示条 — 硬件转发（PPE）vs CPU 路径数据包对比
- **PSE 端口队列状态** 网格（P0-P9），含 IQ/OQ 队列深度与丢包计数

### PPE 流卸载表
- 显示前 100 条 PPE 条目，包含状态（BND/UNB）、类型（IPv4/IPv6/L2B）、五元组及 MAC 地址
- 每 5 秒自动刷新

### 主题适配
- 运行时采样页面背景亮度，自动检测深色/浅色模式
- 兼容 Glass、Bootstrap、Bootstrap-dark 及所有 LuCI 主题
- 全程使用 CSS 自定义属性，无硬编码颜色

## 系统要求

- 搭载 LuCI 的 OpenWrt（24.10+）
- Airoha AN7581 目标平台（`@TARGET_airoha`）
- PPE debugfs（`/sys/kernel/debug/ppe/entries`）
- **`devmem`** busybox 小程序 — Frame Engine 寄存器访问和 CPU 超频必需（`CONFIG_BUSYBOX_DEFAULT_DEVMEM=y`）
- 可选：[air_tools](https://github.com/merbanan/air_tools) 脚本，用于更多 Frame Engine 调试功能

## 安装方法

### 集成到 OpenWrt 编译
```sh
# 添加到编译树
git clone https://github.com/luanmuc/luci-app-airoha-npu.git package/luci-app-airoha-npu

# 在 menuconfig 中启用
make menuconfig
# 导航至：LuCI -> Applications -> luci-app-airoha-npu

# 编译
make package/luci-app-airoha-npu/compile V=s
```

### 手动安装（开发调试）
```sh
# 将文件复制到路由器
scp root/usr/libexec/rpcd/luci.airoha_npu root@router:/usr/libexec/rpcd/
scp root/usr/share/luci/menu.d/luci-app-airoha-npu.json root@router:/usr/share/luci/menu.d/
scp root/usr/share/rpcd/acl.d/luci-app-airoha-npu.json root@router:/usr/share/rpcd/acl.d/
scp htdocs/luci-static/resources/view/airoha_npu/status.js root@router:/www/luci-static/resources/view/airoha_npu/

# 设置权限并重启 rpcd
ssh root@router 'chmod +x /usr/libexec/rpcd/luci.airoha_npu && /etc/init.d/rpcd restart'
```

## 数据来源

| 数据 | 来源 | 是否必需 |
|------|------|----------|
| NPU 状态 | `/sys/bus/platform/drivers/airoha-npu/`、`dmesg` | 是 |
| CPU 频率 | `/sys/devices/system/cpu/cpufreq/policy0/` | 是 |
| 超频 PLL | `devmem` 寄存器（0x1fa202b4、0x1fa202b8） | devmem |
| PPE 条目 | `/sys/kernel/debug/ppe/{entries,bind}` | 是 |
| Frame Engine（GDM/CDM/PSE） | `devmem` 寄存器（0x1fb50xxx-0x1fb53xxx） | devmem |

## 项目结构

```
luci-app-airoha-npu/
├── Makefile                                          # OpenWrt 软件包构建
├── htdocs/
│   └── luci-static/resources/view/airoha_npu/
│       └── status.js                                 # LuCI JavaScript 视图
├── root/
│   └── usr/
│       ├── libexec/rpcd/
│       │   └── luci.airoha_npu                       # RPC 后端（Shell 脚本）
│       └── share/
│           ├── luci/menu.d/
│           │   └── luci-app-airoha-npu.json          # 菜单配置
│           └── rpcd/acl.d/
│               └── luci-app-airoha-npu.json          # ACL 权限
└── screenshots/                                      # 界面截图
```

## RPC 方法

| 方法 | 说明 | 参数 |
|------|------|------|
| `getStatus` | NPU、CPU、PPE 摘要 | — |
| `getPpeEntries` | PPE 流表（前 100 条） | — |
| `getFrameEngine` | PSE/GDM/CDM 寄存器计数 | — |
| `setGovernor` | 更改 CPU 调度策略 | `governor` |
| `setMaxFreq` | 设置 CPU 最大频率 | `freq`（kHz） |
| `setOverclock` | 直接 PLL 频率设定 | `freq_mhz` |

## 版本历史

### v1.2.1
- 修复 PSE 端口映射表（修正 P0-P9 索引，补充缺失的 P9）
- 修复翻译字符串不匹配问题（更新 NPU 描述）
- 修复 JSON 输出中特殊字符的转义
- 修复 sleep 0.02 兼容性问题（改用 usleep）
- 修复 PPE 条目类型字段尾部空格
- 新增 dmesg 解析作为 /proc/iomem 的回退方案
- 新增超频失败回滚机制
- 新增 GDM3 计数器文档说明
- 改进 Argon 主题检测（支持浅色模式）
- 更新 README 版本徽章和下载链接

### v1.2.0
- 移除 XG-040G-MD 有线设备的 WiFi 相关功能
- 从 PSE 队列显示中移除 WiFi DMA 端口
- 更新纯有线以太网配置的 UI 描述
- 修复 rpcd 脚本权限

### v1.1.0
- 新增从 thermal_zone0 独立读取 CPU 温度
- 新增 cpufreq 不可用时 PLL 寄存器频率回退
- 新增 EN7581 兼容性的固件路径回退
- 改进深色模式和响应式布局

### v1.0.1
- 统一 Frame Engine 图表，架构布局匹配 AN7581 数据路径
- 新增 NPU 和 PPE 引擎卡片，含实时状态和流计数
- 修复 GDM4 寄存器地址（0x2500，非 0x3500）

### v1.0.0
- CPU 频率管理，含调度策略和超频控制
- NPU 与卸载引擎监控
- Frame Engine 可视化（GDM 端口、CDM 卸载比率、PSE 队列）
- PPE 流卸载表，支持自动刷新
- 主题自适应深色/浅色模式检测

## 许可证

Apache-2.0

## 作者

Ryan Chen — 为 W1700K 路由器（Airoha AN7581 + MT7996 BE19000）创建
