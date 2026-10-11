'use strict';
'require view';
'require poll';
'require rpc';
'require ui';

var callNpuStatus = rpc.declare({ object: 'luci.airoha_npu', method: 'getStatus' });
var callPpeEntries = rpc.declare({ object: 'luci.airoha_npu', method: 'getPpeEntries' });
var callFrameEngine = rpc.declare({ object: 'luci.airoha_npu', method: 'getFrameEngine' });
var callSetGovernor = rpc.declare({ object: 'luci.airoha_npu', method: 'setGovernor', params: ['governor'] });
var callSetMaxFreq = rpc.declare({ object: 'luci.airoha_npu', method: 'setMaxFreq', params: ['freq'] });
var callSetOverclock = rpc.declare({ object: 'luci.airoha_npu', method: 'setOverclock', params: ['freq_mhz'] });

/* ── Theme-adaptive CSS (with dark mode + responsive + Argon optimization) ── */
var themeCSS = '\
.soc-card{background:var(--soc-card-bg);border:1px solid var(--soc-border);border-radius:8px;padding:14px;transition:border-color .3s,background-color .3s}\
.soc-card-accent{border-left-width:3px;border-left-style:solid}\
.soc-muted{color:var(--soc-muted)}\
.soc-text{color:var(--soc-text)}\
.soc-label{font-size:11px;color:var(--soc-muted)}\
.soc-bar-track{background:var(--soc-bar-track);border-radius:4px;overflow:hidden}\
.soc-fe-layout{display:flex;gap:12px;margin-bottom:10px;padding:0 8px;align-items:stretch}\
.soc-fe-left{flex:1;min-width:0;display:flex;flex-direction:column}\
.soc-fe-right{flex:1;min-width:0;display:flex;flex-direction:column}\
.soc-queue-bar{display:flex;gap:10px;font-size:11px;margin-top:auto;padding-top:6px;border-top:1px solid var(--soc-border)}\
/* Section spacing */\
.soc-section{margin-bottom:16px}\
.soc-section-title{font-size:15px;font-weight:600;margin-bottom:10px;color:var(--soc-text)}\
/* CPU frequency table row height consistency */\
#cpu-freq-table .tr{height:45px}\
#cpu-freq-table .td{vertical-align:middle;padding:6px 10px}\
#cpu-freq-table td:first-child{width:33%}\
#cpu-freq-table td:last-child{text-align:left}\
#cpu-freq-table select{height:auto;min-height:30px;padding:3px 8px;font-size:13px}\
#cpu-freq-table input[type="number"]{height:auto;min-height:30px;padding:3px 8px;font-size:13px}\
#cpu-freq-table button{height:auto;min-height:30px;padding:3px 12px;font-size:13px}\
/* NPU table row height consistency */\
#npu-table .tr{height:45px}\
#npu-table .td{vertical-align:middle;padding:6px 10px}\
#npu-table td:first-child{width:33%}\
#npu-table td:last-child{text-align:left}\
/* Overclock description inline */\
.soc-oc-desc{font-size:12px;color:var(--soc-muted);margin-left:8px;white-space:nowrap}\
/* PPE table responsive wrapper */\
.soc-table-wrap{overflow-x:auto;-webkit-overflow-scrolling:touch;margin:0 -1px}\
.soc-table-wrap .table{min-width:600px;margin-bottom:0}\
/* NPU table (row height set above) */\
/* PPE config table */\
#ppe-config-table .tr{height:32px}\
#ppe-config-table .td,#ppe-config-table .th{vertical-align:middle;padding:4px 10px}\
#ppe-config-table td:first-child,#ppe-config-table th:first-child{width:33%}\
#ppe-config-table td:last-child,#ppe-config-table th:last-child{text-align:left}\
#ppe-config-table td:last-child{font-family:monospace;font-size:12px}\
/* FE card统一边框和最小高度 */\
.soc-fe-card{min-height:100px;display:flex;flex-direction:column;flex:1}\
.soc-fe-gdm,.soc-fe-cdm,.soc-fe-ppe,.soc-fe-pse{border:1px solid var(--soc-border);border-radius:8px;padding:10px 12px;margin-bottom:10px;background:var(--soc-card-bg)}\
.soc-fe-ppe{border-left:3px solid #2196f3}\
/* PPE config details arrow rotation */\
#ppe-config-details[open] #ppe-config-arrow{transform:rotate(90deg)}\
/* Touch optimization */\
.soc-card select,.soc-card input,.soc-card button{min-height:36px}\
/* ── Responsive: Tablet ( < 768px ) ── */\
@media(max-width:768px){\
  .soc-fe-layout{flex-direction:column;gap:8px}\
  .soc-card{padding:12px}\
  #fe-diagram .soc-card{padding:10px 12px}\
}\
/* ── Responsive: Mobile ( < 480px ) ── */\
@media(max-width:480px){\
  .soc-card{padding:10px;border-radius:6px}\
  .soc-label{font-size:10px}\
  .soc-text{font-size:13px}\
  #cpu-freq-bar-wrap{flex-direction:column;align-items:stretch;gap:6px}\
  #cpu-freq-bar-wrap > span{text-align:center;font-size:11px}\
  #cpu-freq-bar-wrap > div{min-width:0;max-width:none}\
  .soc-card select,.soc-card input,.soc-card button{min-height:44px}\
}\
';

function isDarkMode() {
	// Sample multiple elements to get a reliable reading
	var els = [document.body, document.querySelector('.main-content'), document.querySelector('#maincontent'), document.querySelector('.cbi-map')];
	for (var i = 0; i < els.length; i++) {
		if (!els[i]) continue;
		var bg = window.getComputedStyle(els[i]).backgroundColor;
		var m = bg.match(/\d+/g);
		if (m && m.length >= 3) {
			var a = m.length >= 4 ? parseFloat(m[3]) : 1;
			if (a < 0.1) continue; // transparent, skip
			var lum = (parseInt(m[0]) * 299 + parseInt(m[1]) * 587 + parseInt(m[2]) * 114) / 1000;
			return lum < 128;
		}
	}
	// Fallback: check if any known dark theme stylesheet is loaded
	var sheets = document.querySelectorAll('link[href*="dark"], link[href*="glass"]');
	return sheets.length > 0;
}

function isArgonTheme() {
	// Detect Argon theme by checking for known classes or attributes (light or dark)
	var body = document.body;
	if (body.classList.contains('dark-theme') || body.classList.contains('argon-dark')) return true;
	if (body.classList.contains('light-theme') || body.classList.contains('argon-light')) return true;
	if (body.getAttribute('data-theme') === 'dark' || body.getAttribute('data-theme') === 'light') return true;
	// Check for Argon-specific CSS variables
	var testEl = document.createElement('div');
	testEl.style.display = 'none';
	document.body.appendChild(testEl);
	var cs = window.getComputedStyle(testEl);
	var hasArgonVar = cs.getPropertyValue('--argon-primary') !== '' || cs.getPropertyValue('--primary-color') !== '';
	document.body.removeChild(testEl);
	return hasArgonVar;
}

var _lastDarkMode = null;
var _lastIsArgon = null;

function injectCSS() {
	var el = document.getElementById('soc-theme-css');
	if (!el) { el = document.createElement('style'); el.id = 'soc-theme-css'; document.head.appendChild(el); }
	var dark = isDarkMode();
	var argon = isArgonTheme();
	if (dark === _lastDarkMode && argon === _lastIsArgon) return;
	_lastDarkMode = dark;
	_lastIsArgon = argon;

	var vars;
	if (dark) {
		if (argon) {
			// Argon dark theme - optimized for Argon's visual language
			vars = ':root{' +
				'--soc-card-bg:#1c1c1e;' +
				'--soc-border:#2c2c2e;' +
				'--soc-muted:#8e8e93;' +
				'--soc-text:#e5e5ea;' +
				'--soc-bar-track:#2c2c2e;' +
				'--soc-table-header-bg:#2c2c2e;' +
				'--soc-table-border:#2c2c2e;' +
				'}';
		} else {
			// Generic dark theme
			vars = ':root{' +
				'--soc-card-bg:#1a1a1a;' +
				'--soc-border:#333;' +
				'--soc-muted:#9e9e9e;' +
				'--soc-text:#e8e8e8;' +
				'--soc-bar-track:#2d2d2d;' +
				'--soc-table-header-bg:#252525;' +
				'--soc-table-border:#333;' +
				'}';
		}
	} else {
		// Light mode - keep clean and bright
		vars = ':root{' +
			'--soc-card-bg:#ffffff;' +
			'--soc-border:#e0e0e0;' +
			'--soc-muted:#757575;' +
			'--soc-text:#212121;' +
			'--soc-bar-track:#eeeeee;' +
			'--soc-table-header-bg:#fafafa;' +
			'--soc-table-border:#e0e0e0;' +
			'}';
	}
	el.textContent = themeCSS + vars;
}

/* ── Helpers ── */

var psePortMap = [
	{ name: 'GDM1', label: 'LAN2/3/4 1G',   color: '#ff9800' },
	{ name: 'GDM2', label: 'PON & WAN',      color: '#4caf50' },
	{ name: 'CDM1', label: 'CPU DMA 1',   color: '#607d8b' },
	{ name: 'GDM3', label: 'GDM3',        color: '#607d8b' },
	{ name: 'CDM2', label: 'CPU DMA 2',   color: '#607d8b' },
	{ name: 'PPE0', label: 'PPE Eng 0',   color: '#2196f3' },
	{ name: 'PPE1', label: 'PPE Eng 1',   color: '#2196f3' },
	{ name: 'PPE2', label: 'PPE Eng 2',   color: '#2196f3' },
	{ name: 'CDM3', label: 'CPU DMA 3',   color: '#607d8b' },
	{ name: 'GDM4', label: 'LAN1 2.5G',   color: '#ff9800' }
];

function fmtFreq(khz) { return (!khz || khz === 0) ? 'N/A' : (khz / 1000).toFixed(0) + ' MHz'; }
function fmtK(n) {
	if (!n || n === 0) return '0';
	if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M';
	if (n >= 1e3) return (n / 1e3).toFixed(1) + 'K';
	return n.toString();
}
function calcTotalMem(regions) {
	var t = 0;
	(regions || []).forEach(function(r) {
		var m = (r.size || '').match(/(\d+)\s*(KiB|MiB|GiB)/i);
		if (m) { var s = parseInt(m[1]); var u = m[2][0].toUpperCase(); t += u === 'G' ? s*1048576 : u === 'M' ? s*1024 : s; }
	});
	return t >= 1024 ? (t/1024).toFixed(0)+' MiB' : t+' KiB';
}


/* ── Frame Engine Diagram (NPU, PPE, and Ethernet offload) ── */
function renderFeDiagram(fe, st) {
	st = st || {};
	if (!fe || fe.error) return E('div', { 'class': 'soc-muted' }, _('devmem not available on this build'));
	var ports = Array.isArray(fe.pse_ports) ? fe.pse_ports : [];

	// Helper: GDM card with PSE queue info
	function gdmCard(key, name, label, color, psePort) {
		var d = fe[key] || {};
		var active = d.tx > 0 || d.rx > 0;
		var pq = psePort != null ? ports.find(function(p){ return p.port === psePort; }) : null;
		var drop = (pq && pq.drops > 0) || d.tx_drop > 0 || d.rx_drop > 0;
		return E('div', { 'class': 'soc-fe-gdm soc-fe-card', 'style': 'border-left:3px solid '+color + (drop?';border-color:#f44336':'') }, [
			E('div', { 'style': 'display:flex;justify-content:space-between;align-items:baseline;margin-bottom:2px' }, [
				E('span', { 'style': 'font-weight:bold;color:'+color+';font-size:14px' }, name),
				E('span', { 'class': 'soc-label' }, 'P'+psePort)
			]),
			E('div', { 'class': 'soc-label', 'style': 'margin-bottom:6px' }, label),
			E('div', { 'style': 'display:flex;align-items:center;min-height:32px;font-size:12px;margin-bottom:4px' }, [
				E('span', { 'style': 'flex:1' }, [E('span', { 'class': 'soc-muted' }, _('发送: ')), E('span', { 'class': 'soc-text' }, fmtK(d.tx))]),
				E('span', { 'style': 'flex:1' }, [E('span', { 'class': 'soc-muted' }, _('接收: ')), E('span', { 'class': 'soc-text' }, fmtK(d.rx))]),
				E('span', { 'style': 'flex:1' }, [
					E('span', { 'class': 'soc-muted' }, _('丢包: ')),
					E('span', { 'style': 'color:' + ((d.tx_drop || 0) + (d.rx_drop || 0) > 0 ? '#f44336' : 'inherit') }, fmtK((d.tx_drop || 0) + (d.rx_drop || 0)))
				])
			]),
			pq ? E('div', { 'style': 'display:flex;align-items:center;min-height:32px;font-size:12px' }, [
				E('span', { 'style': 'flex:1' }, [E('span', { 'class': 'soc-muted' }, _('入队: ') + pq.iq)]),
				E('span', { 'style': 'flex:1' }, [E('span', { 'class': 'soc-muted' }, _('出队: ') + pq.oq)]),
				E('span', { 'style': 'flex:1' }, pq.drops > 0 ? [E('span', { 'style': 'color:#f44336' }, _('丢包: ') + fmtK(pq.drops))] : [])
			]) : null
		]);
	}

	// Helper: CDM offload bar with PSE queue info
	function cdmCard(key, name, label, psePort) {
		var d = fe[key] || {};
		var total = (d.rx_cpu||0) + (d.rx_hwf||0);
		var pct = total > 0 ? ((d.rx_hwf/total)*100).toFixed(1) : '0.0';
		var barCol = total===0 ? 'var(--soc-border)' : parseFloat(pct)>80 ? '#4caf50' : parseFloat(pct)>50 ? '#ff9800' : '#f44336';
		var pq = psePort != null ? ports.find(function(p){ return p.port === psePort; }) : null;
		return E('div', { 'class': 'soc-fe-cdm soc-fe-card', 'style': 'border-left:3px solid #607d8b' }, [
			E('div', { 'style': 'display:flex;justify-content:space-between;margin-bottom:6px' }, [
				E('span', { 'style': 'font-weight:bold;color:#607d8b;font-size:13px' }, name),
				E('span', { 'class': 'soc-label' }, label+' (P'+psePort+')')
			]),
			E('div', { 'style': 'display:flex;justify-content:space-between;align-items:center;margin-bottom:6px' }, [
				E('span', { 'class': 'soc-text', 'style': 'font-size:12px' }, _('硬件卸载: ') + pct + '%'),
				E('div', { 'class': 'soc-bar-track', 'style': 'height:6px;flex:1;margin-left:10px' }, [
					E('div', { 'style': 'background:'+barCol+';height:100%;width:'+pct+'%;transition:width .5s;border-radius:4px' })
				])
			]),
			E('div', { 'style': 'display:flex;align-items:center;min-height:32px;font-size:12px' }, [
				E('span', { 'style': 'flex:1' }, [E('span', { 'class': 'soc-muted' }, _('CPU: ') + fmtK(d.rx_cpu||0))]),
				E('span', { 'style': 'flex:1' }, [E('span', { 'class': 'soc-muted' }, _('硬件转发: ') + fmtK(d.rx_hwf||0))]),
				E('span', { 'style': 'flex:1' }, [E('span', { 'class': 'soc-muted' }, _('发送: ') + fmtK(d.tx||0))])
			]),
			pq ? E('div', { 'style': 'display:flex;align-items:center;min-height:32px;font-size:12px' }, [
				E('span', { 'style': 'flex:1' }, [E('span', { 'class': 'soc-muted' }, _('入队: ') + pq.iq)]),
				E('span', { 'style': 'flex:1' }, [E('span', { 'class': 'soc-muted' }, _('出队: ') + pq.oq)]),
				E('span', { 'style': 'flex:1' }, pq.drops > 0 ? [E('span', { 'style': 'color:#f44336' }, _('丢包: ') + fmtK(pq.drops))] : [])
			]) : null
		]);
	}


	// PSE buffer
	var pseT = (fe.pse_used||0)+(fe.pse_free||0);
	var pseP = pseT>0 ? ((fe.pse_used/pseT)*100).toFixed(1) : '0';
	var pseCol = parseFloat(pseP)>80?'#f44336':parseFloat(pseP)>50?'#ff9800':'#4caf50';

	// PPE engines card
	var ppeCard = E('div', { 'class': 'soc-fe-ppe soc-fe-card' }, [
		E('div', { 'style': 'display:flex;justify-content:space-between;align-items:center;margin-bottom:8px' }, [
			E('span', { 'style': 'font-weight:bold;color:#2196f3;font-size:14px' }, 'PPE ' + _('引擎')),
			E('span', { 'class': 'soc-label' }, 'P5 / P6 / P7')
		]),
		E('div', { 'style': 'display:flex;align-items:center;min-height:32px;font-size:12px;flex:1' }, [
			E('span', { 'style': 'flex:1' }, [
				E('span', { 'class': 'soc-muted' }, _('已绑定: ')),
				E('span', { 'class': 'soc-text', 'style': 'font-weight:bold', 'id': 'fe-ppe-bound' }, (st.offload_bound||0).toString())
			]),
			E('span', { 'style': 'flex:1' }, [
				E('span', { 'class': 'soc-muted' }, _('总计: ')),
				E('span', { 'class': 'soc-text', 'id': 'fe-ppe-total' }, (st.offload_total||0).toString())
			]),
			E('span', { 'style': 'flex:1' }, [])
		])
	]);

	return E('div', { 'id': 'fe-diagram' }, [
		// PSE buffer bar
		E('div', { 'class': 'soc-fe-pse', 'style': 'margin:0 8px 10px' }, [
			E('div', { 'style': 'display:flex;justify-content:space-between;margin-bottom:4px' }, [
				E('span', { 'class': 'soc-text', 'style': 'font-weight:bold;font-size:13px' }, _('PSE 共享缓冲区')),
				E('span', { 'class': 'soc-muted', 'style': 'font-size:12px' }, (fe.pse_used||0) + _(' 已用 / ') + (fe.pse_free||0) + _(' 空闲 (') + pseP + '%)')
			]),
			E('div', { 'class': 'soc-bar-track', 'style': 'height:8px' }, [
				E('div', { 'style': 'background:'+pseCol+';height:100%;width:'+pseP+'%;border-radius:4px;transition:width .5s' })
			])
		]),
		// Two-column: GDM (left) | CDM + PPE (right)
		E('div', { 'class': 'soc-fe-layout' }, [
			// Left: GDM ports
			E('div', { 'class': 'soc-fe-left' }, [
				gdmCard('gdm2', 'PON & WAN', 'GDM2 (USXGMII 10G)', '#4caf50', 1),
				gdmCard('gdm4', 'LAN1', 'GDM4 (EN8811H 2.5G)', '#ff9800', 9),
				gdmCard('gdm1', 'LAN2/3/4', 'GDM1 (内部交换 1G)', '#ff9800', 0)
			]),
			// Right: CDM + PPE
			E('div', { 'class': 'soc-fe-right' }, [
				cdmCard('cdm1', 'CDM1', 'CPU DMA 1', 2),
				cdmCard('cdm2', 'CDM2', 'CPU DMA 2', 4),
				ppeCard
			])
		])
	]);
}

/* ── CPU Frequency ── */
function freqBarState(hw, min, max, pll, gov, freqSource) {
	var oc = gov==='performance' && pll>0 && (pll*1000)>max;
	return { freq: oc ? pll*1000 : Math.min(hw,max), max: oc ? pll*1000 : max, oc: oc, source: freqSource || 'cpufreq' };
}
function renderFreqBar(hw, min, max, pll, gov, freqSource) {
	if (!max) return E('span',{},'N/A');
	var s = freqBarState(hw,min,max,pll,gov,freqSource);
	var pct = Math.round(((s.freq-min)/(s.max-min))*100);
	pct = Math.max(0,Math.min(100,pct));
	var bg = s.oc ? 'linear-gradient(90deg,#e65100,#ff9800)' : 'linear-gradient(90deg,#2e7d32,#66bb6a)';
	var label = s.oc ? (pll+' MHz (OC)') : fmtFreq(s.freq);
	// PLL fallback indicator
	var pllBadge = '';
	if (s.source === 'pll') {
		pllBadge = ' <span style="background:#ff9800;color:#fff;padding:1px 5px;border-radius:3px;font-size:9px;font-weight:600;margin-left:6px;">' + _('PLL Estimate') + '</span>';
	}
	return E('div', { 'id':'cpu-freq-bar-wrap', 'style':'display:flex;align-items:center;gap:10px' }, [
		E('span', { 'class':'soc-muted', 'style':'font-size:90%' }, fmtFreq(min)),
		E('div', { 'style':'flex:1;border-radius:4px;height:22px;position:relative;min-width:180px;max-width:350px;overflow:hidden', 'class':'soc-bar-track' }, [
			E('div', { 'id':'cpu-freq-fill', 'style':'background:'+bg+';height:100%;border-radius:4px;width:'+pct+'%;transition:width .5s' }),
			E('span', { 'id':'cpu-freq-text', 'style':'position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-weight:bold;font-size:13px;color:#fff;text-shadow:0 1px 2px rgba(0,0,0,.6)' }, 
				E('span', { 'id': 'cpu-freq-label' }, label + pllBadge)
			)
		]),
		E('span', { 'id':'cpu-freq-max-label', 'class':'soc-muted', 'style':'font-size:90%' }, fmtFreq(s.max))
	]);
}
function updateFreqBar(hw, min, max, pll, gov, freqSource) {
	var s = freqBarState(hw,min,max,pll,gov,freqSource);
	var el = document.getElementById('cpu-freq-label'), fl = document.getElementById('cpu-freq-fill'), ml = document.getElementById('cpu-freq-max-label');
	if (el) {
		var label = s.oc ? (pll+' MHz (OC)') : fmtFreq(s.freq);
		var pllBadge = s.source === 'pll' ? ' <span style="background:#ff9800;color:#fff;padding:1px 5px;border-radius:3px;font-size:9px;font-weight:600;margin-left:6px;">' + _('PLL Estimate') + '</span>' : '';
		el.innerHTML = label + pllBadge;
	}
	if (fl && s.max>0) { var pct=Math.max(0,Math.min(100,Math.round(((s.freq-min)/(s.max-min))*100))); fl.style.width=pct+'%'; fl.style.background=s.oc?'linear-gradient(90deg,#e65100,#ff9800)':'linear-gradient(90deg,#2e7d32,#66bb6a)'; }
	if (ml) ml.textContent = fmtFreq(s.max);
}

var govNameMap = {
	'performance': '性能模式',
	'ondemand': '按需调度',
	'schedutil': '调度器',
	'powersave': '节能模式',
	'conservative': '保守模式',
	'userspace': '用户空间'
};
function renderGovSelect(avail, active) {
	var gs = (avail||'').trim().split(/\s+/).filter(Boolean);
	if (!gs.length) return E('span',{},'N/A');
	return E('select', { 'id':'cpu-governor-select','class':'cbi-input-select','style':'min-width:160px','change':function(ev){
		var g=ev.target.value; ev.target.disabled=true;
		callSetGovernor(g).then(function(r){ev.target.disabled=false;if(r&&r.error) ui.addNotification(null,E('p',{},_('Error: ')+r.error),'error');}).catch(function(){ev.target.disabled=false;});
	}}, gs.map(function(g){
		var label = govNameMap[g] ? (govNameMap[g]+' ('+g+')') : g;
		return E('option',{'value':g,'selected':g===active?'':null},label);
	}));
}
function renderMaxFreqSelect(avail, cur) {
	var fs = (avail||'').trim().split(/\s+/).filter(Boolean);
	if (!fs.length) return E('span',{},'N/A');
	return E('select', { 'id':'cpu-maxfreq-select','class':'cbi-input-select','style':'min-width:140px','change':function(ev){
		var f=ev.target.value; ev.target.disabled=true;
		callSetMaxFreq(parseInt(f)).then(function(r){ev.target.disabled=false;if(r&&r.error) ui.addNotification(null,E('p',{},_('Error: ')+r.error),'error');}).catch(function(){ev.target.disabled=false;});
	}}, fs.map(function(f){return E('option',{'value':f,'selected':parseInt(f)===parseInt(cur)?'':null},(parseInt(f)/1000).toFixed(0)+' MHz');}));
}
function renderOcControls() {
	var inp = E('input',{'id':'oc-freq-input','type':'number','min':'500','max':'1600','step':'50','value':'1400','class':'cbi-input-text','style':'width:100px'});
	var btn = E('button',{'class':'cbi-button cbi-button-action','style':'margin-left:8px','click':function(){
		var f=parseInt(document.getElementById('oc-freq-input').value);
		if(isNaN(f)||f<500||f>1600){ui.addNotification(null,E('p',{},_('Frequency must be 500-1600 MHz')),'error');return;}
		if(f>1400&&!confirm(_('Frequencies above 1400 MHz may be unstable. Continue?'))) return;
		btn.disabled=true;btn.textContent=_('Applying...');
		callSetOverclock(f).then(function(r){btn.disabled=false;btn.textContent=_('Apply');
			if(r&&r.error) ui.addNotification(null,E('p',{},_('Overclock failed: ')+r.error),'error');
			else if(r&&r.result==='ok') ui.addNotification(null,E('p',{},_('CPU set to ')+r.actual_mhz+' MHz'),'info');
		}).catch(function(e){btn.disabled=false;btn.textContent=_('Apply');});
	}},_('Apply'));
	return E('div',{'style':'display:flex;align-items:center;gap:8px;flex-wrap:wrap'},[
		inp, E('span',{'class':'soc-muted'},'MHz'), btn,
		E('span',{'class':'soc-oc-desc'},_('直接写入 PLL 寄存器。调频策略锁定为性能模式。标称最高 1200 MHz，实测 1500 MHz 稳定。'))
	]);
}

/* ── PPE Config Table ── */
function renderPpeConfigRows(config) {
	if (!config) return [];
	return config.split('\n').filter(function(line){ return line.trim(); }).map(function(line) {
		var parts = line.split(':');
		if (parts.length < 2) return null;
		var key = parts[0].trim();
		var val = parts.slice(1).join(':').trim();
		return E('tr',{'class':'tr'},[
			E('td',{'class':'td'}, E('code',{'style':'font-size:11px;color:var(--soc-muted)'}, key)),
			E('td',{'class':'td'}, E('code',{'style':'font-size:11px'}, val))
		]);
	}).filter(Boolean);
}

/* ── PPE Table ── */
function renderPpeRows(entries) {
	return entries.slice(0,100).map(function(e) {
		var eth = e.eth||''; if(eth==='00:00:00:00:00:00->00:00:00:00:00:00') eth='-';
		return E('tr',{'class':'tr'},[
			E('td',{'class':'td'},e.index), E('td',{'class':'td'},E('span',{'class':e.state==='BND'?'label-success':''},e.state)),
			E('td',{'class':'td'},e.type), E('td',{'class':'td'},e.orig||'-'), E('td',{'class':'td'},e.new_flow||'-'), E('td',{'class':'td'},eth)
		]);
	});
}

/* ── Main View ── */
return view.extend({
	load: function() {
		return Promise.all([ callNpuStatus(), callPpeEntries(), callFrameEngine() ]);
	},
	render: function(data) {
		injectCSS();
		var st = data[0]||{}, ppe = data[1]||{}, fe = data[2]||{};
		var entries = Array.isArray(ppe.entries) ? ppe.entries : [];
		var memR = Array.isArray(st.memory_regions) ? st.memory_regions : [];
		var freqSource = st.cpu_freq_source || 'cpufreq';
		var cpuTemp = st.cpu_temp || 0;
		var tempDisplay = cpuTemp > 0 ? (cpuTemp + ' °C') : 'N/A';

		var view = E('div',{'class':'cbi-map'},[
			E('h2',{'style':'margin-top:8px;margin-bottom:14px'},_('Airoha SoC 状态')),
			// CPU Frequency
			E('div',{'class':'cbi-section soc-section'},[
				E('h3',{},_('CPU 频率')),
				E('table',{'class':'table','id':'cpu-freq-table'},[
					E('tr',{'class':'tr'},[ E('td',{'class':'td'},E('strong',{},_('当前频率'))), E('td',{'class':'td'}, renderFreqBar(st.cpu_hw_freq,st.cpu_min_freq,st.cpu_max_freq,st.pll_freq_mhz,st.cpu_governor,freqSource)) ]),
					E('tr',{'class':'tr'},[ E('td',{'class':'td'},E('strong',{},_('CPU 温度'))), E('td',{'class':'td','id':'cpu-temp'}, tempDisplay) ]),
					E('tr',{'class':'tr'},[ E('td',{'class':'td'},E('strong',{},_('调频策略'))), E('td',{'class':'td'}, renderGovSelect(st.cpu_avail_governors,st.cpu_governor)) ]),
					E('tr',{'class':'tr'},[ E('td',{'class':'td'},E('strong',{},_('最高频率'))), E('td',{'class':'td'}, renderMaxFreqSelect(st.cpu_avail_freqs,st.cpu_max_freq)) ]),
					E('tr',{'class':'tr'},[ E('td',{'class':'td'},E('strong',{},_('超频'))), E('td',{'class':'td'}, renderOcControls()) ]),
					E('tr',{'class':'tr'},[ E('td',{'class':'td'},E('strong',{},_('CPU 核心数'))), E('td',{'class':'td'},(st.cpu_count||0).toString()) ])
				])
			]),
			// NPU
			E('div',{'class':'cbi-section soc-section'},[
				E('h3',{},_('NPU')),
				E('table',{'class':'table','id':'npu-table'},[
					E('tr',{'class':'tr'},[ E('td',{'class':'td'},E('strong',{},_('NPU 状态'))),
						E('td',{'class':'td','id':'npu-status'}, st.npu_loaded ?
							E('span',{'class':'label-success'},_('已激活')) :
							E('span',{'class':'label-danger'},_('未激活'))) ]),
					E('tr',{'class':'tr'},[ E('td',{'class':'td'},E('strong',{},_('SoC 平台'))),
						E('td',{'class':'td','id':'npu-compatible'}, st.npu_compatible || 'N/A') ]),
					E('tr',{'class':'tr'},[ E('td',{'class':'td'},E('strong',{},_('固件版本'))),
						E('td',{'class':'td','id':'npu-fw-ver'}, st.npu_version && st.npu_version !== 'Unknown' ? st.npu_version : (st.npu_fw_ver || 'N/A')) ]),
					E('tr',{'class':'tr'},[ E('td',{'class':'td'},E('strong',{},_('时钟 / 核心数'))),
						E('td',{'class':'td','id':'npu-clk-cores'}, (st.npu_clock?(st.npu_clock/1e6).toFixed(0)+' MHz':'N/A')+' | '+(st.npu_cores||0)+' ' + _('核心')) ]),
					E('tr',{'class':'tr'},[ E('td',{'class':'td'},E('strong',{},_('保留内存'))),
						E('td',{'class':'td','id':'npu-memory'}, calcTotalMem(memR)) ]),
					E('tr',{'class':'tr'},[ E('td',{'class':'td'},E('strong',{},_('说明'))),
						E('td',{'class':'td'}, '8x RISC-V 通过 PCIe 连接 RAM — PPE 初始化、流/PON 卸载、数据包处理') ])
				])
			]),
			// PPE Config (separate collapsible section)
			st.ppe_config ? E('div',{'class':'cbi-section soc-section'},[
				E('details',{'id':'ppe-config-details','style':'border:1px solid var(--soc-border);border-radius:8px;padding:10px 12px;background:var(--soc-card-bg)'},[
					E('summary',{'style':'cursor:pointer;font-size:15px;font-weight:600;color:var(--soc-text);list-style:none;display:flex;align-items:center'}, [
						E('span',{'id':'ppe-config-arrow','style':'margin-right:8px;font-size:12px;transition:transform .2s'},'▶'),
						_('PPE 配置寄存器')
					]),
					E('div',{'style':'font-size:13px;color:var(--soc-muted);margin:8px 0 10px 20px'},_('PPE 硬件转发引擎的底层寄存器配置，用于调试和诊断。')),
					E('div',{'class':'soc-table-wrap'},[
						E('table',{'class':'table','id':'ppe-config-table'},[
							E('tr',{'class':'tr cbi-section-table-titles'},[
								E('th',{'class':'th'},_('寄存器')), E('th',{'class':'th'},_('值'))
							])
						].concat(renderPpeConfigRows(st.ppe_config)))
					])
				])
			]) : null,
			// Hardware Offload Engine
			E('div',{'class':'cbi-section soc-section'},[
				E('h3',{},_('硬件卸载引擎')),
				E('div',{'id':'fe-container'}, renderFeDiagram(fe, st))
			]),
			// PPE Flow Table - with responsive scroll wrapper
			E('div',{'class':'cbi-section soc-section'},[
				E('h3',{},_('PPE 硬件流表')),
				E('div',{'class':'soc-table-wrap'},[
					E('table',{'class':'table','id':'ppe-entries-table'},[
						E('tr',{'class':'tr cbi-section-table-titles'},[
							E('th',{'class':'th'},_('索引')), E('th',{'class':'th'},_('状态')), E('th',{'class':'th'},_('类型')),
							E('th',{'class':'th'},_('原始流')), E('th',{'class':'th'},_('新流')), E('th',{'class':'th'},_('以太网'))
						])
					].concat(renderPpeRows(entries)))
				])
			])
		]);

		poll.add(L.bind(function() {
			return Promise.all([ callNpuStatus(), callPpeEntries(), callFrameEngine() ]).then(L.bind(function(d) {
				injectCSS();
				var st=d[0]||{}, ppe=d[1]||{}, fe=d[2]||{};
				var entries = Array.isArray(ppe.entries)?ppe.entries:[];
				var freqSrc = st.cpu_freq_source || 'cpufreq';

				updateFreqBar(st.cpu_hw_freq,st.cpu_min_freq,st.cpu_max_freq,st.pll_freq_mhz,st.cpu_governor,freqSrc);

				// Update CPU temperature
				var tempEl = document.getElementById('cpu-temp');
				if (tempEl) {
					var t = st.cpu_temp || 0;
					tempEl.textContent = t > 0 ? (t + ' °C') : 'N/A';
				}

				var gs=document.getElementById('cpu-governor-select'); if(gs&&!gs.matches(':focus')) gs.value=st.cpu_governor||'';
				var fs=document.getElementById('cpu-maxfreq-select'); if(fs&&!fs.matches(':focus')) fs.value=(st.cpu_max_freq||0).toString();

				var se=document.getElementById('npu-status');
				if(se){se.innerHTML='';var sp=document.createElement('span');sp.className=st.npu_loaded?'label-success':'label-danger';sp.textContent=st.npu_loaded?_('已激活'):_('未激活');se.appendChild(sp);}

				var fc=document.getElementById('fe-container'); if(fc){fc.innerHTML='';fc.appendChild(renderFeDiagram(fe, st));}

				var tb=document.getElementById('ppe-entries-table');
				if(tb){while(tb.rows.length>1)tb.deleteRow(1);renderPpeRows(entries).forEach(function(r){tb.appendChild(r);});}
			},this));
		},this), 5);

		return view;
	},
	handleSaveApply: null, handleSave: null, handleReset: null
});
