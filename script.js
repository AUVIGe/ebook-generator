/* ========================================================================
 *  📚 一键电子书生成器
 *  - 文件解析（PDF / Word）
 *  - 重新排版（章节识别、目录）
 *  - AI 封面（Pollinations.ai）
 *  - 二维码（qrcode.js）
 *  - 海报合成（Canvas 720×1280）
 *  - 电子书查看器（hash 路由、9:16、字体/主题/行距、目录跳转）
 * ======================================================================== */

// ============== 全局状态 ==============
const state = {
  file: null,
  fileName: '',
  fileText: '',
  coverMethod: 'ai',
  coverImage: null,         // 用户上传的封面 dataURL
  aiCoverUrl: null,         // AI 生成的封面 URL
  bookTitle: '',
  bookAuthor: '',
  ebookData: null
};

const $ = (id) => document.getElementById(id);
const show = (id) => $(id).classList.remove('hidden');
const hide = (id) => $(id).classList.add('hidden');

// ============== 步骤1：文件上传 ==============
function setupUpload() {
  const area = $('uploadArea');
  const input = $('fileInput');

  area.addEventListener('click', () => input.click());
  area.addEventListener('dragover', (e) => {
    e.preventDefault();
    area.classList.add('dragover');
  });
  area.addEventListener('dragleave', () => area.classList.remove('dragover'));
  area.addEventListener('drop', (e) => {
    e.preventDefault();
    area.classList.remove('dragover');
    if (e.dataTransfer.files.length) handleFile(e.dataTransfer.files[0]);
  });
  input.addEventListener('change', (e) => {
    if (e.target.files.length) handleFile(e.target.files[0]);
  });
}

async function handleFile(file) {
  const ext = file.name.split('.').pop().toLowerCase();
  if (!['pdf', 'doc', 'docx', 'txt', 'epub', 'md'].includes(ext)) {
    showWarn('❌ 暂仅支持 PDF / Word / TXT / EPUB / MD 格式');
    return;
  }
  hide('wordCountWarn');
  state.file = file;
  state.fileName = file.name;

  // 解析中提示
  $('fileInfo').innerHTML = `<span>⏳ 正在解析 ${file.name}…</span>`;
  show('fileInfo');

  // 更新右侧元信息
  $('metaFilename').textContent = file.name;
  $('metaWords').textContent = '解析中…';

  try {
    let text = '';
    if (ext === 'pdf') text = await parsePDF(file);
    else if (['doc', 'docx'].includes(ext)) text = await parseWord(file);
    else if (['txt', 'md', 'epub'].includes(ext)) {
      // TXT/MD/EPUB 直接当文本读
      text = await file.text();
      if (ext === 'epub') text = text.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
    }
    text = (text || '').trim();
    const wordCount = text.length;

    if (wordCount === 0) {
      hide('fileInfo');
      showWarn('❌ 文档内容为空，无法生成电子书');
      return;
    }

    state.fileText = text;
    $('fileInfo').innerHTML = `
      <b>${file.name}</b>
      <span>· 字数 <b>${wordCount.toLocaleString()}</b></span>
      <span class="badge-ok">✓ 已就绪</span>
    `;

    $('metaFilename').textContent = file.name;
    $('metaWords').textContent = wordCount.toLocaleString() + ' 字';
    $('metaTime').textContent = wordCount < 5000 ? '约 10 秒' : (wordCount < 30000 ? '约 30 秒' : '约 1 分钟');
    setStatus('ready', '已就绪，可以生成');

    // 自动提取书名 / 作者
    if (!state.bookTitle) {
      state.bookTitle = extractTitle(text);
      $('bookTitle').value = state.bookTitle;
    }
    if (!state.bookAuthor) {
      state.bookAuthor = extractAuthor(text);
      $('bookAuthor').value = state.bookAuthor;
    }

    // 启用第 2、3 步
    enableStep(2);
    enableStep(3);
    checkGenerateReady();
  } catch (err) {
    console.error(err);
    hide('fileInfo');
    showWarn('❌ 解析失败：' + (err.message || err));
  }
}

function showWarn(msg) {
  $('wordCountWarn').textContent = msg;
  show('wordCountWarn');
}

function enableStep(n) {
  $(`step${n}`).classList.remove('disabled');
}

// ============== 文档解析 ==============
async function parsePDF(file) {
  if (!window.pdfjsLib) throw new Error('PDF 解析库未加载');
  pdfjsLib.GlobalWorkerOptions.workerSrc = 'lib/pdf.worker.min.js';
  const buf = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: buf }).promise;
  let all = '';
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    let lastY = null, line = '';
    for (const item of (content.items || [])) {
      // 某些 PDF 项可能没有 str 或 transform（如 markContent）
      if (!item || typeof item.str !== 'string') continue;
      const y = (item.transform && item.transform[5]) || 0;
      if (lastY !== null && Math.abs(y - lastY) > 4) {
        all += line.trim() + '\n';
        line = '';
      }
      line += item.str + ' ';
      lastY = y;
    }
    if (line.trim()) all += line.trim() + '\n';
    all += '\n';
  }
  return all;
}

async function parseWord(file) {
  if (!window.mammoth) throw new Error('Word 解析库未加载');
  const buf = await file.arrayBuffer();
  const result = await mammoth.extractRawText({ arrayBuffer: buf });
  return result.value;
}

function extractTitle(text) {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  for (const line of lines.slice(0, 12)) {
    if (line.length >= 2 && line.length <= 50 && !/^作者|^author|^by/i.test(line)) {
      return line;
    }
  }
  return '我的电子书';
}

function extractAuthor(text) {
  const m = text.match(/(?:作者|Author|By|by)[：:\s]+([^\n\r]+)/);
  if (m) return m[1].trim().slice(0, 30);
  return '';
}

// ============== 步骤2：封面 ==============
function setupCoverTabs() {
  document.querySelectorAll('.cover-option').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.cover-option').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.coverMethod = btn.dataset.method;
      document.querySelectorAll('.cover-panel').forEach(p => p.classList.remove('active'));
      $(`${state.coverMethod}CoverPanel`).classList.add('active');
      checkGenerateReady();
    });
  });

  // 上传封面
  $('coverUploadArea').addEventListener('click', () => $('coverInput').click());
  $('coverInput').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      state.coverImage = ev.target.result;
      $('uploadCoverPreview').innerHTML = `<img src="${ev.target.result}" alt="封面预览">`;
      // 实时更新右侧 3D 书本封面
      updateRightCover(ev.target.result);
      checkGenerateReady();
    };
    reader.readAsDataURL(file);
  });

  // 监听书名/作者
  $('bookTitle').addEventListener('input', (e) => {
    state.bookTitle = e.target.value;
    updateRightBookTitle();
  });
  $('bookAuthor').addEventListener('input', (e) => {
    state.bookAuthor = e.target.value;
  });
}

function checkGenerateReady() {
  const hasFile = !!state.fileText;
  const hasCover = state.coverMethod === 'ai' || !!state.coverImage;
  $('generateBtn').disabled = !(hasFile && hasCover);
}

// ============== 右侧实时预览 ==============
function setupMoreSettings() {
  const row = $('moreRow');
  const arrow = $('moreArrow');
  const panel = $('moreSettings');
  row.addEventListener('click', () => {
    panel.classList.toggle('hidden');
    arrow.classList.toggle('rotate');
  });
  // 缩略图点击
  document.querySelectorAll('.thumb').forEach(thumb => {
    thumb.addEventListener('click', () => {
      document.querySelectorAll('.thumb').forEach(t => t.classList.remove('active'));
      thumb.classList.add('active');
      const idx = parseInt(thumb.dataset.thumb, 10);
      // 高亮对应的 dot
      const dots = document.querySelectorAll('.thumbs-dots .dot');
      dots.forEach((d, i) => d.classList.toggle('active', i === idx));
    });
  });
}

function setStatus(state, text) {
  const el = $('previewStatus');
  el.classList.remove('ready', 'generating');
  if (state === 'ready') el.classList.add('ready');
  else if (state === 'generating') el.classList.add('generating');
  el.querySelector('.status-text').textContent = text;
}

function updateRightCover(dataUrl) {
  // 3D 书本封面
  $('bookCoverInner').innerHTML = `<img src="${dataUrl}" style="width:100%;height:100%;object-fit:cover;">`;
  // 缩略图封面
  $('thumbCover').innerHTML = `<img src="${dataUrl}" style="width:100%;height:100%;object-fit:cover;">`;
}

function updateRightBookTitle() {
  // 如果已有封面，刷新缩略图（不影响 3D 书本）
  // 这里仅用于展示书名
}

function updateThumbsPreview() {
  // 生成中间缩略图（封面/目录/内页/分享卡）
  if (!state.ebookData) return;
  // 封面
  if (state.ebookData.cover) {
    $('thumbCover').innerHTML = `<img src="${state.ebookData.cover}" style="width:100%;height:100%;object-fit:cover;">`;
    $('bookCoverInner').innerHTML = `<img src="${state.ebookData.cover}" style="width:100%;height:100%;object-fit:cover;">`;
  }
  // 目录
  const tocHtml = '<div style="padding:8px;font-size:8px;line-height:1.6;color:#333;">' +
    state.ebookData.chapters.slice(0, 6).map((c, i) =>
      `<div style="padding:3px 0;border-bottom:1px dashed #ddd;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${i+1}. ${escapeHtml(c.title)}</div>`
    ).join('') +
    (state.ebookData.chapters.length > 6 ? `<div style="padding:3px 0;color:#888;">…还有 ${state.ebookData.chapters.length - 6} 章</div>` : '') +
    '</div>';
  $('thumbToc').innerHTML = tocHtml;
  // 内页
  if (state.ebookData.chapters[0]) {
    const c = state.ebookData.chapters[0];
    const contentSnippet = (c.content || '').replace(/<[^>]+>/g, '').slice(0, 60);
    $('thumbPage').innerHTML = `<div style="padding:6px;font-size:7px;line-height:1.5;color:#333;text-align:left;">
      <div style="font-weight:bold;margin-bottom:4px;font-size:9px;">${escapeHtml(c.title)}</div>
      <div>${escapeHtml(contentSnippet)}…</div>
    </div>`;
  }
}

async function updateThumbQr() {
  if (!state.ebookData) return;
  try {
    const data = { ...state.ebookData, cover: null };
    const comp = LZString.compressToEncodedURIComponent(JSON.stringify(data));
    const full = window.location.origin + window.location.pathname + '#/ebook?d=' + comp;
    let url;
    if (full.length <= QR_MAX_BYTES) {
      url = full;
    } else {
      url = window.location.origin + window.location.pathname;
    }
    const qr = await generateQRCode(url);
    $('thumbQr').innerHTML = `<img src="${qr}" style="width:100%;height:100%;object-fit:contain;background:white;">`;
  } catch (e) {
    $('thumbQr').innerHTML = '<div class="thumb-placeholder">二维码</div>';
  }
}

// ============== 步骤3：一键生成 ==============
$('generateBtn').addEventListener('click', generateEbook);

async function generateEbook() {
  show('loadingOverlay');
  setStatus('generating', '生成中…');
  resetProgress();

  try {
    // 1. 解析文档
    markStep('parse', 'active');
    await sleep(300);
    const text = state.fileText;
    markStep('parse', 'done');

    // 2. 重新排版
    markStep('reflow', 'active');
    await sleep(200);
    const chapters = reflowText(text);
    markStep('reflow', 'done');

    // 3. 绘制封面
    markStep('cover', 'active');
    let coverUrl = state.coverImage;
    if (state.coverMethod === 'ai') {
      coverUrl = await generateAICover(state.bookTitle, state.bookAuthor, text);
    } else {
      // 上传封面时，把书名/作者叠加
      coverUrl = await overlayTextOnCover(state.coverImage, state.bookTitle, state.bookAuthor);
    }
    markStep('cover', 'done');

    // 构造电子书数据
    state.ebookData = {
      title: state.bookTitle || '未命名电子书',
      author: state.bookAuthor || '',
      cover: coverUrl,
      chapters
    };

    // 实时更新右侧预览缩略图
    updateThumbsPreview();
    await updateThumbQr();

    // 4. 生成访问 URL（判断是否能装进 QR）
    markStep('qrcode', 'active');
    const baseUrl = window.location.origin + window.location.pathname;
    let ebookUrl, mode;
    // 为了让 URL 能装进 QR，cover 不入 URL（扫码进入后用 title 动态生成）
    // 完整 cover 用作下载 HTML 内的封面
    const dataForUrl = { ...state.ebookData, cover: null };
    const compressed = LZString.compressToEncodedURIComponent(JSON.stringify(dataForUrl));
    // 用 query string (?d=) 而非 hash 路由，微信扫码识别更稳定
    const fullUrl = `${baseUrl}?d=${compressed}`;
    if (fullUrl.length <= QR_MAX_BYTES) {
      ebookUrl = fullUrl;
      mode = 'url';
    } else {
      ebookUrl = baseUrl;
      mode = 'download';
    }
    // 本地生成 QR（100% 离线），尺寸 1000px 在大画布上画，微信可识
    const qrDataUrl = await generateQRCode(ebookUrl, { dark: '#000000', light: '#ffffff', size: 1000 });
    markStep('qrcode', 'done');

    // 5. 合成海报（使用完整 cover）
    markStep('poster', 'active');
    const posterDataUrl = await generatePoster(coverUrl, qrDataUrl, state.ebookData.title, ebookUrl, mode, ebookUrl);
    markStep('poster', 'done');

    await sleep(400);
    hide('loadingOverlay');
    setStatus('ready', '已完成');

    // 显示结果弹层
    $('posterImage').src = posterDataUrl;
    $('downloadBtn').href = posterDataUrl;
    $('downloadBtn').download = `${state.ebookData.title}-海报.png`;

    if (mode === 'url') {
      $('openEbookBtn').href = ebookUrl;
      $('openEbookBtn').textContent = '📖 打开电子书';
      $('openEbookBtn').onclick = null;
      $('openEbookBtn').target = '_blank';
      $('copyUrlBtn').style.display = '';
      $('resultTip').innerHTML = '✅ 已发布到服务器。扫描海报上的二维码，即可在手机上阅读这本书。';
    } else {
      // 长内容模式：额外提供 HTML 文件下载（含完整 cover）
      const htmlBlob = makeEbookHtml(state.ebookData);
      const htmlUrl = URL.createObjectURL(htmlBlob);
      $('openEbookBtn').href = htmlUrl;
      $('openEbookBtn').textContent = '📥 下载电子书 HTML';
      $('openEbookBtn').onclick = (e) => {
        e.preventDefault();
        const a = document.createElement('a');
        a.href = htmlUrl;
        a.download = `${state.ebookData.title || 'ebook'}.html`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(htmlUrl), 60000);
      };
      $('copyUrlBtn').style.display = 'none';
      $('resultTip').innerHTML = '📦 内容超过 QR 容量上限，已生成<strong>可独立打开的 HTML 文件</strong>，扫码进主页后下载此文件双击阅读。';
    }

    $('copyUrlBtn').onclick = () => {
      navigator.clipboard.writeText(ebookUrl).then(() => {
        const t = $('copyUrlBtn').textContent;
        $('copyUrlBtn').textContent = '✓ 已复制';
        setTimeout(() => $('copyUrlBtn').textContent = t, 1800);
      }).catch(() => {
        const ta = document.createElement('textarea');
        ta.value = ebookUrl;
        document.body.appendChild(ta);
        ta.select();
        try { document.execCommand('copy'); } catch (_) {}
        document.body.removeChild(ta);
        $('copyUrlBtn').textContent = '✓ 已复制';
        setTimeout(() => $('copyUrlBtn').textContent = t, 1800);
      });
    };

    show('resultModal');
  } catch (err) {
    console.error('[generateEbook] error:', err);
    hide('loadingOverlay');
    setStatus('idle', '生成失败');
    const msg = (err && (err.stack || err.message)) || String(err);
    alert('生成失败：' + (err.message || err) + '\n\n请打开浏览器控制台看完整错误。');
  }
}

function resetProgress() {
  document.querySelectorAll('.loading-step').forEach(el => {
    el.classList.remove('active', 'done');
  });
}
function markStep(name, cls) {
  const el = document.querySelector(`.loading-step[data-step="${name}"]`);
  if (el) el.classList.add(cls);
}
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// ============== AI 封面生成 ==============
// 策略：尝试调用远程 AI 生图（快速超时），失败则用本地 Canvas 生成渐变+文字封面
const COVER_PALETTES = [
  ['#1e3a8a', '#6366f1', '#a855f7'],  // 幽蓝→紫
  ['#0f172a', '#1e40af', '#0ea5e9'],  // 深空→海蓝
  ['#7c2d12', '#ea580c', '#fbbf24'],  // 暗红→暖黄
  ['#064e3b', '#059669', '#a3e635'],  // 森林→草绿
  ['#831843', '#db2777', '#fda4af'],  // 酒红→粉
  ['#1e1b4b', '#4338ca', '#06b6d4'],  // 深夜→青
  ['#4c1d95', '#7c3aed', '#f0abfc'],  // 紫罗兰
  ['#0c4a6e', '#0284c7', '#67e8f9'],  // 冰川
  ['#365314', '#65a30d', '#fde047'],  // 草原
  ['#44403c', '#78716c', '#fef3c7']   // 拿铁
];

async function generateAICover(title, author, text) {
  const safeTitle = (title || extractTitle(text || '') || '未命名电子书').slice(0, 30);
  const safeAuthor = (author || extractAuthor(text || '') || '').slice(0, 20);

  // 预览先显示加载中
  $('aiCoverPreview').innerHTML = '<span class="placeholder">🎨 正在生成封面…</span>';

  // 主题色：根据书名 hash 选一套
  const themeIdx = (simpleHash(safeTitle) + simpleHash(text || '')) % COVER_PALETTES.length;
  const palette = COVER_PALETTES[themeIdx];
  const theme = extractThemeForImage(text);

  // 1) 先尝试调远程 AI 生图（3秒超时），失败了走本地
  let remoteUrl = null;
  try {
    const prompt = `Book cover art for "${safeTitle}" by ${safeAuthor || 'unknown'}, ${theme}, vertical composition, beautiful illustration, 9:16 aspect ratio, no text`;
    const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=720&height=1280&nologo=true&seed=${Math.floor(Math.random() * 100000)}`;
    // 快速探测：限 3.5 秒
    const ok = await probeImageUrl(url, 3500);
    if (ok) remoteUrl = url;
  } catch (_) {
    remoteUrl = null;
  }

  let coverDataUrl;
  if (remoteUrl) {
    try {
      // 下载远程图片转 dataURL（避免后续 canvas 跨域问题）
      coverDataUrl = await fetchImageAsDataURL(remoteUrl, 10000);
    } catch (e) {
      console.warn('remote cover fetch failed, fallback to local', e);
      coverDataUrl = null;
    }
  }

  if (!coverDataUrl) {
    // 2) 本地降级：纯 Canvas 生成好看的渐变+几何封面
    coverDataUrl = await generateLocalCover(safeTitle, safeAuthor, palette, theme);
  }

  // 把书名/作者叠加到封面（如果本地生成的没加，就 overlay 一次）
  if (!safeAuthor) {
    // 已有 title 时 本地已加过 title
  } else if (!coverDataUrl.startsWith('data:image/png;base64,iVBORw')) {
    // 远程图：overlay 一次文字
    try { coverDataUrl = await overlayTextOnCover(coverDataUrl, safeTitle, safeAuthor); } catch (_) {}
  }

  $('aiCoverPreview').innerHTML = `<img src="${coverDataUrl}" alt="AI 封面预览">`;
  return coverDataUrl;
}

function simpleHash(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

function extractThemeForImage(text) {
  const sample = (text || '').slice(0, 300).replace(/[\r\n]+/g, ' ');
  const phrases = sample.match(/[\u4e00-\u9fa5A-Za-z]{2,6}/g) || [];
  // 过滤常见停用词
  const stop = new Set(['的', '了', '是', '在', '我', '有', '和', '就', '不', '人', '都', '一', '一个', '上', '也', '很', '到', '说', '要', '去', '你', '会', '着', '没有', '看', '好', '自己', '这', '那', '他', '她', '它']);
  const filtered = phrases.filter(p => !stop.has(p));
  return filtered.slice(0, 4).join(', ') || 'literature, story';
}

// 探测 URL 是否能在指定毫秒内成功加载
function probeImageUrl(url, timeout) {
  return new Promise((resolve) => {
    const img = new Image();
    let done = false;
    const finish = (ok) => { if (!done) { done = true; resolve(ok); } };
    const t = setTimeout(() => finish(false), timeout);
    img.onload = () => { clearTimeout(t); finish(true); };
    img.onerror = () => { clearTimeout(t); finish(false); };
    img.crossOrigin = 'anonymous';
    img.src = url;
  });
}

// 拉取远程图片转 dataURL（带超时）
async function fetchImageAsDataURL(url, timeout) {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeout);
  try {
    const r = await fetch(url, { signal: controller.signal });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const blob = await r.blob();
    return await new Promise((resolve, reject) => {
      const fr = new FileReader();
      fr.onload = () => resolve(fr.result);
      fr.onerror = reject;
      fr.readAsDataURL(blob);
    });
  } finally {
    clearTimeout(t);
  }
}

// 本地生成的封面（始终可用）
async function generateLocalCover(title, author, palette, theme) {
  const c = document.createElement('canvas');
  c.width = 720; c.height = 1280;
  const ctx = c.getContext('2d');

  // 渐变背景
  const g = ctx.createLinearGradient(0, 0, 0, 1280);
  g.addColorStop(0, palette[0]);
  g.addColorStop(0.5, palette[1]);
  g.addColorStop(1, palette[2]);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 720, 1280);

  // 径向高光
  const r = ctx.createRadialGradient(360, 480, 50, 360, 480, 600);
  r.addColorStop(0, 'rgba(255,255,255,0.18)');
  r.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = r;
  ctx.fillRect(0, 0, 720, 1280);

  // 抽象几何装饰
  ctx.globalAlpha = 0.08;
  for (let i = 0; i < 12; i++) {
    ctx.fillStyle = '#fff';
    const size = 30 + Math.random() * 80;
    ctx.beginPath();
    ctx.arc(Math.random() * 720, Math.random() * 1280, size, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 0.05;
  for (let i = 0; i < 6; i++) {
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(Math.random() * 720, Math.random() * 1280, 60 + Math.random() * 100, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;

  // 书名（中心）
  if (title) {
    ctx.fillStyle = 'rgba(255,255,255,0.95)';
    ctx.font = 'bold 64px "PingFang SC", "Microsoft YaHei", sans-serif';
    ctx.textAlign = 'center';
    ctx.shadowColor = 'rgba(0,0,0,0.4)';
    ctx.shadowBlur = 12;
    wrapText(ctx, title, 360, 600, 640, 76);
  }
  // 作者
  if (author) {
    ctx.shadowBlur = 6;
    ctx.font = '26px "PingFang SC", "Microsoft YaHei", sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.fillText('—— ' + author + ' ——', 360, title ? 760 : 640);
  }
  ctx.shadowBlur = 0;
  // 缩小到 240×426 节省 base64 空间（1.2KB 左右）
  const small = document.createElement('canvas');
  small.width = 240; small.height = 426;
  small.getContext('2d').drawImage(c, 0, 0, 240, 426);
  return small.toDataURL('image/jpeg', 0.55);
}

// 上传封面时，叠加书名/作者（用 Canvas 合成）
async function overlayTextOnCover(imgDataUrl, title, author) {
  if (!title && !author) return imgDataUrl;
  const img = await loadImage(imgDataUrl);
  const c = document.createElement('canvas');
  c.width = 720; c.height = 1280;
  const ctx = c.getContext('2d');
  // 底图（按比例缩放到 9:16）
  drawCoverContain(ctx, img, 720, 1280);
  // 顶部暗化
  const grad = ctx.createLinearGradient(0, 0, 0, 400);
  grad.addColorStop(0, 'rgba(0,0,0,0.5)');
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 720, 400);
  // 底部暗化
  const grad2 = ctx.createLinearGradient(0, 880, 0, 1280);
  grad2.addColorStop(0, 'rgba(0,0,0,0)');
  grad2.addColorStop(1, 'rgba(0,0,0,0.6)');
  ctx.fillStyle = grad2;
  ctx.fillRect(0, 880, 720, 400);
  // 文字
  if (title) {
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 44px "PingFang SC", "Microsoft YaHei", sans-serif';
    ctx.textAlign = 'center';
    ctx.shadowColor = 'rgba(0,0,0,0.6)';
    ctx.shadowBlur = 8;
    wrapText(ctx, title, 360, 200, 640, 52);
  }
  if (author) {
    ctx.font = '24px "PingFang SC", "Microsoft YaHei", sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.92)';
    ctx.fillText('—— ' + author + ' ——', 360, title ? 280 : 200);
  }
  ctx.shadowBlur = 0;
  // 缩小到 240×426
  const small = document.createElement('canvas');
  small.width = 240; small.height = 426;
  small.getContext('2d').drawImage(c, 0, 0, 240, 426);
  return small.toDataURL('image/jpeg', 0.55);
}

function drawCoverContain(ctx, img, w, h) {
  const r = Math.min(w / img.width, h / img.height);
  const dw = img.width * r, dh = img.height * r;
  const dx = (w - dw) / 2, dy = (h - dh) / 2;
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(img, dx, dy, dw, dh);
}

function wrapText(ctx, text, x, y, maxWidth, lineHeight) {
  // 简单中文/英文混排自动换行
  const chars = text.split('');
  let line = '', ty = y;
  for (const ch of chars) {
    const test = line + ch;
    if (ctx.measureText(test).width > maxWidth && line) {
      ctx.fillText(line, x, ty);
      line = ch; ty += lineHeight;
    } else {
      line = test;
    }
  }
  if (line) ctx.fillText(line, x, ty);
}

// ============== 智能排版（章节识别） ==============
function reflowText(rawText) {
  // 规范化空白
  const text = rawText.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  const fullText = lines.join('\n');

  // 章节正则
  const patterns = [
    /^第\s*[一二三四五六七八九十百千零〇\d]+\s*[章节回卷篇集部][：:、\s]*[^\n]*$/gm,
    /^Chapter\s+\d+[：:\s]*[^\n]*$/gmi,
    /^第\s*\d+\s*章[：:\s]*[^\n]*$/gm,
    /^\d+[\.、][^\n]{2,30}$/gm
  ];

  let matches = [];
  for (const p of patterns) {
    const m = [...fullText.matchAll(p)];
    if (m.length >= 2) { matches = m; break; }
  }

  if (matches.length > 0) {
    // 按章节切分
    const chapters = [];
    for (let i = 0; i < matches.length; i++) {
      const start = matches[i].index;
      const end = i < matches.length - 1 ? matches[i + 1].index : fullText.length;
      const block = fullText.slice(start, end);
      const nlIdx = block.indexOf('\n');
      const title = (nlIdx > 0 ? block.slice(0, nlIdx) : block).trim().slice(0, 40);
      const body = (nlIdx > 0 ? block.slice(nlIdx + 1) : '').trim();
      if (body) chapters.push({ title, content: formatParagraphs(body) });
    }
    // 章节前的内容（如序言/前言）
    const firstStart = matches[0].index;
    if (firstStart > 30) {
      const pre = fullText.slice(0, firstStart).trim();
      if (pre) {
        // 尝试从中识别"序/前言"等
        const m = pre.match(/^(序\s*言|前\s*言|引\s*子|自\s*序|写在前面|Prologue|Foreword|Preface)[：:、\s]*/i);
        const title = m ? m[0].replace(/[：:、\s]+$/, '').trim() : '序言';
        chapters.unshift({ title, content: formatParagraphs(pre.replace(m ? m[0] : '', '').trim()) });
      }
    }
    return chapters.length ? chapters : [{ title: '正文', content: formatParagraphs(fullText) }];
  }

  // 未识别到章节 → 按段落数量自动分章节
  const paragraphs = fullText.split(/\n+/).map(p => p.trim()).filter(p => p.length > 0);
  if (paragraphs.length <= 1) {
    return [{ title: '正文', content: formatParagraphs(fullText) }];
  }
  // 每 6-10 段为一章
  const groupSize = paragraphs.length <= 20 ? 5 : (paragraphs.length <= 50 ? 8 : 10);
  const chapters = [];
  for (let i = 0; i < paragraphs.length; i += groupSize) {
    const group = paragraphs.slice(i, i + groupSize);
    chapters.push({
      title: `第 ${chapters.length + 1} 节`,
      content: formatParagraphs(group.join('\n\n'))
    });
  }
  return chapters;
}

function formatParagraphs(text) {
  return text
    .split(/\n+/)
    .map(p => p.trim())
    .filter(p => p.length > 0)
    .map(p => `<p>${escapeHtml(p)}</p>`)
    .join('');
}

function escapeHtml(s) {
  return (s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ============== 电子书 URL（二维码内容）==============
function buildEbookUrl(data) {
  // 压缩后存到 URL hash（避免后端存储）
  const json = JSON.stringify(data);
  const compressed = LZString.compressToEncodedURIComponent(json);
  const base = window.location.origin + window.location.pathname;
  return `${base}#/ebook?d=${compressed}`;
}

// ============== 生成独立可打开的 HTML 文件 ==============
// 超长内容打包成单文件 HTML（包含数据 + 阅读器），用户双击就能阅读
function makeEbookHtml(data) {
  const json = JSON.stringify(data);
  const escapedJson = json.replace(/<\/script/g, '<\\/script').replace(/<!--/g, '<\\!--');
  const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
<title>${escapeHtml(data.title || '电子书')}</title>
<style>${getEbookCss()}</style>
</head>
<body>
<div id="ebook-view" class="view active">
  <div class="ebook-container">
    <div class="ebook-frame" id="ebookFrame">
      <div class="ebook-header">
        <button class="icon-btn" id="menuBtn">☰</button>
        <span class="ebook-title">${escapeHtml(data.title || '电子书')}</span>
        <button class="icon-btn" id="settingsBtn">⚙</button>
      </div>
      <div class="ebook-content" id="ebookContent"></div>
      <div class="ebook-footer">
        <button class="nav-btn" id="prevBtn">← 上一节</button>
        <span class="progress" id="progress">1/1</span>
        <button class="nav-btn" id="nextBtn">下一节 →</button>
      </div>
      <div class="sidebar" id="sidebar">
        <div class="side-header"><h3>📖 目录</h3><button class="icon-btn close-btn" id="closeSidebar">×</button></div>
        <div class="toc" id="toc"></div>
      </div>
      <div class="sidebar" id="settingsPanel">
        <div class="side-header"><h3>⚙ 阅读设置</h3><button class="icon-btn close-btn" id="closeSettings">×</button></div>
        <div class="setting-item">
          <label class="setting-label">字号大小</label>
          <div class="font-controls">
            <button data-size="small">小</button>
            <button data-size="medium" class="active">中</button>
            <button data-size="large">大</button>
            <button data-size="xlarge">超大</button>
          </div>
        </div>
        <div class="setting-item">
          <label class="setting-label">阅读配色</label>
          <div class="theme-controls">
            <button data-theme="light" class="active">☀️ 白天</button>
            <button data-theme="sepia">📜 护眼</button>
            <button data-theme="dark">🌙 夜晚</button>
          </div>
        </div>
        <div class="setting-item">
          <label class="setting-label">行距</label>
          <div class="line-controls">
            <button data-line="compact">紧凑</button>
            <button data-line="normal" class="active">标准</button>
            <button data-line="loose">宽松</button>
          </div>
        </div>
      </div>
    </div>
  </div>
</div>
<script>window.__EBOOK_DATA__ = ${escapedJson};<\/script>
<script>
(function(){
  var data = window.__EBOOK_DATA__;
  var ebookState = { data: data, currentIndex: 0 };
  function $(id){return document.getElementById(id);}
  function escapeHtml(s){return (s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}
  function showChapter(idx) {
    var d = ebookState.data;
    ebookState.currentIndex = idx;
    var c = $('ebookContent'); c.scrollTop = 0;
    if (idx === 0) {
      c.innerHTML = '<div class="cover-page">' +
        (d.cover ? '<img src="' + d.cover + '" alt="封面" onerror="this.style.display=\\'none\\'">' : '') +
        '<h1>' + escapeHtml(d.title) + '</h1>' +
        (d.author ? '<p class="author">' + escapeHtml(d.author) + '</p>' : '') +
        '<p class="hint">👆 点击左上角 ☰ 打开目录</p>' +
        '<p class="hint">👆 点击右上角 ⚙ 调节字号/配色/行距</p>' +
        '</div>';
    } else {
      var ch = d.chapters[idx-1];
      c.innerHTML = '<h1 class="chapter-title">' + escapeHtml(ch.title) + '</h1>' + ch.content;
    }
    document.querySelectorAll('.toc-item').forEach(function(it){
      it.classList.toggle('active', parseInt(it.dataset.index,10) === idx);
    });
    $('progress').textContent = (idx+1) + ' / ' + (d.chapters.length+1);
    $('prevBtn').disabled = idx === 0;
    $('nextBtn').disabled = idx === d.chapters.length;
  }
  function renderEbook(d) {
    ebookState.data = d;
    var tocHtml = '<div class="toc-item active" data-index="0">📖 封面</div>';
    d.chapters.forEach(function(c,i){
      tocHtml += '<div class="toc-item" data-index="' + (i+1) + '">' + (i+1) + '. ' + escapeHtml(c.title) + '</div>';
    });
    $('toc').innerHTML = tocHtml;
    $('toc').querySelectorAll('.toc-item').forEach(function(it){
      it.addEventListener('click', function(){
        showChapter(parseInt(it.dataset.index,10));
        $('sidebar').classList.remove('open');
      });
    });
    showChapter(0);
  }
  renderEbook(data);
  $('menuBtn').addEventListener('click', function(){$('sidebar').classList.add('open');});
  $('closeSidebar').addEventListener('click', function(){$('sidebar').classList.remove('open');});
  $('settingsBtn').addEventListener('click', function(){$('settingsPanel').classList.add('open');});
  $('closeSettings').addEventListener('click', function(){$('settingsPanel').classList.remove('open');});
  $('prevBtn').addEventListener('click', function(){ if(ebookState.currentIndex>0) showChapter(ebookState.currentIndex-1); });
  $('nextBtn').addEventListener('click', function(){ if(ebookState.currentIndex<ebookState.data.chapters.length) showChapter(ebookState.currentIndex+1); });
  document.addEventListener('keydown', function(e){
    if (e.key === 'ArrowLeft' && ebookState.currentIndex>0) showChapter(ebookState.currentIndex-1);
    if (e.key === 'ArrowRight' && ebookState.currentIndex<ebookState.data.chapters.length) showChapter(ebookState.currentIndex+1);
    if (e.key === 'Escape') {$('sidebar').classList.remove('open'); $('settingsPanel').classList.remove('open');}
  });
  function updateFrame(){
    var font = document.querySelector('.font-controls button.active').dataset.size;
    var theme = document.querySelector('.theme-controls button.active').dataset.theme;
    var line = document.querySelector('.line-controls button.active').dataset.line;
    $('ebookFrame').className = 'ebook-frame font-' + font + ' theme-' + theme + ' line-' + line;
  }
  document.querySelectorAll('.font-controls button').forEach(function(b){
    b.addEventListener('click', function(){
      document.querySelectorAll('.font-controls button').forEach(function(x){x.classList.remove('active');});
      b.classList.add('active'); updateFrame();
    });
  });
  document.querySelectorAll('.theme-controls button').forEach(function(b){
    b.addEventListener('click', function(){
      document.querySelectorAll('.theme-controls button').forEach(function(x){x.classList.remove('active');});
      b.classList.add('active'); updateFrame();
    });
  });
  document.querySelectorAll('.line-controls button').forEach(function(b){
    b.addEventListener('click', function(){
      document.querySelectorAll('.line-controls button').forEach(function(x){x.classList.remove('active');});
      b.classList.add('active'); updateFrame();
    });
  });
})();
<\/script>
</body>
</html>`;
  return new Blob([html], { type: 'text/html;charset=utf-8' });
}

function getEbookCss() {
  // 从主样式表抽离需要的阅读器样式（不依赖外部 CSS）
  return `
body { margin:0; font-family:-apple-system,BlinkMacSystemFont,"PingFang SC","Microsoft YaHei",sans-serif; background:#f5f7fb; }
.ebook-container { min-height:100vh; display:flex; align-items:center; justify-content:center; padding:24px; box-sizing:border-box; }
.ebook-frame { width:100%; max-width:420px; aspect-ratio:9/16; background:#fff; border-radius:24px; overflow:hidden; display:flex; flex-direction:column; box-shadow:0 30px 80px rgba(0,0,0,0.4); position:relative; }
.ebook-header { display:flex; align-items:center; justify-content:space-between; padding:14px 16px; background:rgba(255,255,255,0.95); backdrop-filter:blur(10px); border-bottom:1px solid rgba(0,0,0,0.06); flex-shrink:0; }
.ebook-title { font-size:15px; font-weight:600; flex:1; text-align:center; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; padding:0 8px; }
.icon-btn { width:36px; height:36px; background:transparent; border:none; border-radius:50%; font-size:18px; color:#333; display:inline-flex; align-items:center; justify-content:center; cursor:pointer; }
.icon-btn:hover { background:rgba(0,0,0,0.06); }
.icon-btn.close-btn { font-size:24px; }
.ebook-content { flex:1; overflow-y:auto; padding:24px 22px; font-size:16px; line-height:1.85; -webkit-overflow-scrolling:touch; }
.ebook-content::-webkit-scrollbar { width:4px; }
.ebook-content::-webkit-scrollbar-thumb { background:rgba(0,0,0,0.15); border-radius:2px; }
.ebook-content p { margin-bottom:14px; text-indent:2em; }
.ebook-content h1 { font-size:22px; margin:0 0 18px; text-align:center; }
.ebook-content h2 { font-size:18px; margin:0 0 14px; }
.ebook-content .chapter-title { font-size:20px; text-align:center; margin:8px 0 24px; }
.ebook-footer { display:flex; align-items:center; justify-content:space-between; padding:12px 16px; background:rgba(255,255,255,0.95); backdrop-filter:blur(10px); border-top:1px solid rgba(0,0,0,0.06); flex-shrink:0; }
.nav-btn { padding:8px 16px; border:1px solid #d8dde8; background:#fff; border-radius:999px; font-size:13px; color:#333; cursor:pointer; }
.nav-btn:disabled { opacity:0.35; cursor:not-allowed; }
.progress { font-size:13px; color:#666; font-weight:500; }
.sidebar { position:absolute; inset:0; background:#fff; z-index:20; display:none; flex-direction:column; animation:slideIn 0.25s ease; }
@keyframes slideIn { from { transform:translateX(100%);} to { transform:translateX(0);} }
.sidebar.open { display:flex; }
.side-header { display:flex; align-items:center; justify-content:space-between; padding:14px 16px; border-bottom:1px solid #f0f0f0; flex-shrink:0; }
.side-header h3 { font-size:16px; }
.toc { flex:1; overflow-y:auto; padding:8px 0; }
.toc-item { padding:14px 20px; border-bottom:1px solid #f5f5f5; cursor:pointer; font-size:14px; }
.toc-item:hover { background:#f7f8fc; }
.toc-item.active { background:linear-gradient(90deg,#eef0ff,transparent); color:#667eea; font-weight:600; border-left:3px solid #667eea; padding-left:17px; }
.setting-item { padding:18px 20px; border-bottom:1px solid #f0f0f0; }
.setting-label { display:block; font-size:14px; color:#555; margin-bottom:12px; font-weight:500; }
.font-controls, .theme-controls, .line-controls { display:flex; gap:8px; flex-wrap:wrap; }
.font-controls button, .theme-controls button, .line-controls button { padding:8px 14px; border:1px solid #d8dde8; background:#fff; border-radius:999px; font-size:13px; color:#555; cursor:pointer; }
.font-controls button.active, .theme-controls button.active, .line-controls button.active { border-color:#667eea; background:#eef0ff; color:#667eea; font-weight:600; }
.ebook-frame.theme-light { background:#fff; color:#2c2c2c; }
.ebook-frame.theme-sepia { background:#f5ecd9; color:#4a3b1f; }
.ebook-frame.theme-dark { background:#1a1d24; color:#d8d8d8; }
.ebook-frame.theme-dark .ebook-header, .ebook-frame.theme-dark .ebook-footer { background:rgba(30,33,40,0.95); color:#d8d8d8; border-color:rgba(255,255,255,0.06); }
.ebook-frame.theme-dark .icon-btn { color:#d8d8d8; }
.ebook-frame.theme-dark .sidebar { background:#1a1d24; color:#d8d8d8; }
.ebook-frame.theme-dark .side-header { border-color:rgba(255,255,255,0.08); }
.ebook-frame.theme-dark .toc-item { border-color:rgba(255,255,255,0.05); }
.ebook-frame.theme-dark .toc-item:hover { background:rgba(255,255,255,0.05); }
.ebook-frame.theme-dark .toc-item.active { background:linear-gradient(90deg,rgba(102,126,234,0.18),transparent); color:#a3b3ff; }
.ebook-frame.theme-dark .nav-btn { background:#2a2d34; border-color:rgba(255,255,255,0.1); color:#d8d8d8; }
.ebook-frame.theme-dark .progress { color:#aaa; }
.ebook-frame.theme-dark .setting-item { border-color:rgba(255,255,255,0.08); }
.ebook-frame.theme-dark .font-controls button, .ebook-frame.theme-dark .theme-controls button, .ebook-frame.theme-dark .line-controls button { background:#2a2d34; border-color:rgba(255,255,255,0.1); color:#d8d8d8; }
.ebook-frame.theme-dark .font-controls button.active, .ebook-frame.theme-dark .theme-controls button.active, .ebook-frame.theme-dark .line-controls button.active { background:rgba(102,126,234,0.2); border-color:#667eea; color:#a3b3ff; }
.ebook-frame.font-small .ebook-content { font-size:14px; }
.ebook-frame.font-medium .ebook-content { font-size:16px; }
.ebook-frame.font-large .ebook-content { font-size:18px; }
.ebook-frame.font-xlarge .ebook-content { font-size:20px; }
.ebook-frame.line-compact .ebook-content { line-height:1.6; }
.ebook-frame.line-normal .ebook-content { line-height:1.85; }
.ebook-frame.line-loose .ebook-content { line-height:2.1; }
.cover-page { text-align:center; padding:20px 0; }
.cover-page img { max-width:70%; max-height:380px; border-radius:8px; box-shadow:0 12px 32px rgba(0,0,0,0.18); margin-bottom:24px; }
.cover-page h1 { font-size:22px; margin-bottom:8px; }
.cover-page .author { color:#888; font-size:14px; margin-bottom:16px; }
.cover-page .hint { color:#aaa; font-size:12px; margin-top:24px; text-indent:0; }
@media (max-width:480px) {
  .ebook-container { padding:0; }
  .ebook-frame { max-width:100%; aspect-ratio:auto; height:100vh; border-radius:0; }
}
`;
}

// ============== 二维码 ==============
// 优先使用本地 qrcode-generator（H 纠错 30% 容错），fallback 到远程服务
const QR_MAX_BYTES = 1200;  // H 纠错下 typeNumber=40 容量 1273 字节

// 远程 QR 服务（多选一，按可用性自动 fallback）
const QR_APIS = [
  // quickchart.io - 默认首选
  (text, size) => `https://quickchart.io/qr?text=${encodeURIComponent(text)}&size=${size}&margin=2&ecLevel=M&format=png`,
  // qrserver.com
  (text, size) => `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(text)}&margin=4&ecc=M&color=000000&bgcolor=ffffff`,
  // goqr.me
  (text, size) => `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(text)}&margin=2&ecc=H`
];

function loadRemoteQR(text, size) {
  // 按顺序尝试每个 API
  return new Promise((resolve, reject) => {
    let i = 0;
    const tryNext = () => {
      if (i >= QR_APIS.length) return reject(new Error('所有远程 QR API 均失败'));
      const apiUrl = QR_APIS[i](text, size);
      i++;
      const img = new Image();
      img.crossOrigin = 'anonymous';
      const timeout = setTimeout(() => { img.onerror && img.onerror(); }, 8000);
      img.onload = () => {
        clearTimeout(timeout);
        try {
          const c = document.createElement('canvas');
          c.width = size; c.height = size;
          const ctx = c.getContext('2d');
          ctx.fillStyle = '#fff';
          ctx.fillRect(0, 0, size, size);
          ctx.drawImage(img, 0, 0, size, size);
          resolve(c.toDataURL('image/png'));
        } catch (e) { tryNext(); }
      };
      img.onerror = () => { clearTimeout(timeout); tryNext(); };
      img.src = apiUrl;
    };
    tryNext();
  });
}

function buildQR(text, level) {
  level = level || 'H';
  const qr = window.qrcode(40, level);
  qr.addData(text);
  qr.make();
  return qr;
}

function drawQRTo(ctx, qr, x, y, size, dark, light) {
  dark = dark || '#000000';
  light = light || '#ffffff';
  const moduleCount = qr.getModuleCount();
  const margin = Math.max(4, Math.floor(moduleCount * 0.05));
  const totalModules = moduleCount + margin * 2;
  const cellSize = size / totalModules;
  ctx.fillStyle = light;
  ctx.fillRect(x, y, size, size);
  ctx.fillStyle = dark;
  const offset = margin * cellSize;
  for (let r = 0; r < moduleCount; r++) {
    for (let col = 0; col < moduleCount; col++) {
      if (qr.isDark(r, col)) {
        ctx.fillRect(x + offset + col * cellSize, y + offset + r * cellSize, Math.ceil(cellSize), Math.ceil(cellSize));
      }
    }
  }
  return { moduleCount, cellSize };
}

function generateQRLocal(text, size) {
  return new Promise((resolve, reject) => {
    if (typeof window.qrcode !== 'function') return reject(new Error('本地库未加载'));
    try {
      const qr = buildQR(text, 'M');
      const moduleCount = qr.getModuleCount();
      const margin = Math.max(4, Math.floor(moduleCount * 0.05));
      const totalModules = moduleCount + margin * 2;
      const s = Math.ceil(totalModules * (size / totalModules));
      const c = document.createElement('canvas');
      c.width = s; c.height = s;
      drawQRTo(c.getContext('2d'), qr, 0, 0, s);
      resolve(c.toDataURL('image/png'));
    } catch (e) { reject(e); }
  });
}

function generateQRCode(text, opts) {
  opts = opts || {};
  const size = opts.size || 1000;  // 1000px 高清原图
  // 优先本地生成（100% 离线可用，不依赖任何远程服务）
  return generateQRLocal(text, size)
    .catch((err) => {
      console.warn('本地 QR 失败，尝试远程 API:', err.message);
      return loadRemoteQR(text, size);
    });
}

// ============== 海报合成 ==============
async function generatePoster(coverUrl, qrDataUrl, title, ebookUrl, mode, qrText) {
  const W = 720, H = 1280;
  const canvas = document.createElement('canvas');
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d');

  // 背景
  const bgGrad = ctx.createLinearGradient(0, 0, 0, H);
  bgGrad.addColorStop(0, '#fafbff');
  bgGrad.addColorStop(1, '#eef0ff');
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, W, H);

  // 顶部 logo / 标题
  ctx.fillStyle = '#667eea';
  ctx.font = 'bold 22px "PingFang SC", "Microsoft YaHei", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('📚 一键电子书 · 扫码即读', W / 2, 50);

  // 微信扫码提示
  ctx.fillStyle = '#ee5a6f';
  ctx.font = '13px "PingFang SC", "Microsoft YaHei", sans-serif';
  ctx.fillText('💡 微信扫不出？复制下方链接到 Safari/Chrome 打开即可', W / 2, 78);

  // 封面（保留 9:16）
  const cover = await loadImage(coverUrl);
  const coverW = 480, coverH = 720;
  const coverX = (W - coverW) / 2, coverY = 90;
  // 阴影
  ctx.shadowColor = 'rgba(20,30,80,0.25)';
  ctx.shadowBlur = 20;
  ctx.shadowOffsetY = 8;
  drawCoverContain(ctx, cover, coverW, coverH, coverX, coverY);
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;

  // 封面边框
  ctx.strokeStyle = 'rgba(255,255,255,0.6)';
  ctx.lineWidth = 2;
  ctx.strokeRect(coverX, coverY, coverW, coverH);

  // 书名（封面下方）
  if (title) {
    ctx.fillStyle = '#1a1a1a';
    ctx.font = 'bold 28px "PingFang SC", "Microsoft YaHei", sans-serif';
    ctx.textAlign = 'center';
    wrapText(ctx, title, W / 2, 850, W - 60, 36);
  }

  // 底部白色卡片：二维码 + 文案
  // 底部白色卡片：二维码 + 文案（QR 加高至 440px）
  const cardX = 40, cardY = 970, cardW = W - 80, cardH = 280;
  roundRect(ctx, cardX, cardY, cardW, cardH, 20);
  ctx.fillStyle = '#ffffff';
  ctx.fill();
  ctx.strokeStyle = '#e2e6f0';
  ctx.lineWidth = 1;
  ctx.stroke();

  // 二维码 - 加大到 440px 显示（来源 dataURL 是 1000px 高清）
  const qrSize = 440;
  if (qrText) {
    const qrObj = buildQR(qrText, 'M');
    drawQRTo(ctx, qrObj, cardX + 20, cardY + (cardH - qrSize) / 2, qrSize);
  } else {
    const qr = await loadImage(qrDataUrl);
    ctx.drawImage(qr, cardX + 20, cardY + (cardH - qrSize) / 2, qrSize, qrSize);
  }

  // 文案
  const textX = cardX + qrSize + 40;
  ctx.textAlign = 'left';
  ctx.fillStyle = '#1a1a1a';
  ctx.font = 'bold 22px "PingFang SC", "Microsoft YaHei", sans-serif';
  if (mode === 'download') {
    ctx.fillText('📥 扫码下载', textX, cardY + 70);
    ctx.font = '15px "PingFang SC", "Microsoft YaHei", sans-serif';
    ctx.fillStyle = '#555';
    ctx.fillText('内容较长（QR 装不下），', textX, cardY + 100);
    ctx.fillText('扫码进主页后下载', textX, cardY + 122);
    ctx.fillText('完整 HTML 电子书', textX, cardY + 144);
  } else {
    ctx.fillText('📱 扫码阅读', textX, cardY + 70);
    ctx.font = '16px "PingFang SC", "Microsoft YaHei", sans-serif';
    ctx.fillStyle = '#555';
    ctx.fillText('支持手机 / 电脑访问', textX, cardY + 100);
    ctx.fillText('打开后可以调节字号、', textX, cardY + 125);
    ctx.fillText('切换白天/夜晚模式', textX, cardY + 150);
  }
  // 短链 (限制宽度避免超界)
  const short = ebookUrl.length > 32 ? ebookUrl.slice(0, 30) + '…' : ebookUrl;
  ctx.font = '12px monospace';
  ctx.fillStyle = '#999';
  ctx.fillText(short, textX, cardY + 200);

  // 底部
  ctx.fillStyle = '#aaa';
  ctx.font = '12px "PingFang SC", "Microsoft YaHei", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('由「一键电子书生成器」生成', W / 2, H - 18);

  return canvas.toDataURL('image/png');
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = (e) => reject(new Error('图片加载失败：' + src.slice(0, 80)));
    img.src = src;
  });
}

function drawCoverContain(ctx, img, w, h, x, y) {
  const r = Math.min(w / img.width, h / img.height);
  const dw = img.width * r, dh = img.height * r;
  const dx = x + (w - dw) / 2, dy = y + (h - dh) / 2;
  // 黑色底避免透明
  ctx.save();
  ctx.beginPath();
  roundRect(ctx, x, y, w, h, 0);
  ctx.clip();
  ctx.fillStyle = '#000';
  ctx.fillRect(x, y, w, h);
  ctx.drawImage(img, dx, dy, dw, dh);
  ctx.restore();
}

// ============== 重置 ==============
$('resetBtn').addEventListener('click', () => {
  state.file = null;
  state.fileName = '';
  state.fileText = '';
  state.coverImage = null;
  state.aiCoverUrl = null;
  state.bookTitle = '';
  state.bookAuthor = '';
  state.ebookData = null;
  $('fileInput').value = '';
  $('coverInput').value = '';
  $('fileInfo').classList.add('hidden');
  $('wordCountWarn').classList.add('hidden');
  $('bookTitle').value = '';
  $('bookTitle2').value = '';
  $('bookAuthor').value = '';
  $('bookAuthor2').value = '';
  $('aiCoverPreview').innerHTML = '<span class="placeholder">🎨 封面将在生成时自动绘制</span>';
  $('uploadCoverPreview').innerHTML = '<span class="placeholder">未选择图片</span>';
  $('resultSection').classList.add('hidden');
  $('step2').classList.add('disabled');
  $('step3').classList.add('disabled');
  $('generateBtn').disabled = true;
  window.scrollTo({ top: 0, behavior: 'smooth' });
});

// ============== 路由：电子书查看器 ==============
const ebookState = { data: null, currentIndex: 0 };

function handleRoute() {
  // 同时支持 hash 路由 (#/ebook?d=) 和 query string (?d=) 两种模式
  // query string 模式对微信内置浏览器更友好（不会截断 # 后内容）
  const search = window.location.search || '';
  const hash = window.location.hash || '';
  const inEbookHash = hash.startsWith('#/ebook');
  const inEbookSearch = search.includes('d=');
  if (inEbookHash || inEbookSearch) {
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    $('ebook-view').classList.add('active');
    // 微信内置浏览器提示
    if (isWechatBrowser()) showWechatGuide();
    try { loadEbookData(); }
    catch (e) { console.error('loadEbook error:', e); }
  } else {
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    $('home-view').classList.add('active');
  }
}

function isWechatBrowser() {
  const ua = navigator.userAgent.toLowerCase();
  return ua.includes('micromessenger') || ua.includes('wxwork');
}

function showWechatGuide() {
  if (document.getElementById('wechat-guide')) return;
  const guide = document.createElement('div');
  guide.id = 'wechat-guide';
  guide.innerHTML = `
    <div class="wechat-guide-content">
      <div class="wechat-guide-icon">📱</div>
      <div class="wechat-guide-text">
        <div class="wechat-guide-title">如电子书显示不完整</div>
        <div class="wechat-guide-sub">点击右上角 ··· 选「<b>在浏览器中打开</b>」</div>
      </div>
      <button class="wechat-guide-close" onclick="this.parentElement.parentElement.remove()">×</button>
    </div>
  `;
  document.body.appendChild(guide);
}

function loadEbookData() {
  // 从 hash 或 search 中提取数据
  const hash = window.location.hash || '';
  const search = window.location.search || '';
  let d = '';
  if (hash.startsWith('#/ebook')) {
    d = (hash.split('?')[1] || '').split('d=')[1] || '';
  } else if (search.includes('d=')) {
    d = search.split('d=')[1].split('&')[0];
  }
  // 去除可能的尾部 & 参数
  d = d.split('&')[0];
  if (!d) {
    $('ebookContent').innerHTML = '<div class="ebook-loading">📖 无效的电子书链接</div>';
    return;
  }
  let json = '';
  try { json = LZString.decompressFromEncodedURIComponent(d) || ''; }
  catch (e) { json = ''; }
  if (!json) {
    $('ebookContent').innerHTML = '<div class="ebook-loading">❌ 电子书数据解析失败<br><small>可能链接已损坏或不完整</small></div>';
    return;
  }
  let data;
  try { data = JSON.parse(json); }
  catch (e) {
    $('ebookContent').innerHTML = '<div class="ebook-loading">❌ 电子书数据格式错误<br><small>' + e.message + '</small></div>';
    return;
  }
  renderEbook(data);
}

function renderEbook(data) {
  ebookState.data = data;
  ebookState.currentIndex = 0;
  $('ebookTitle').textContent = data.title || '电子书';

  // 如果没有 cover，动态生成一个
  if (!data.cover) {
    const paletteIdx = (simpleHash(data.title || '') + simpleHash((data.chapters[0]||{}).title || '')) % COVER_PALETTES.length;
    const palette = COVER_PALETTES[paletteIdx];
    generateLocalCover(data.title || '未命名', data.author || '', palette, 'literature').then(d => {
      ebookState.data.cover = d;
      // 重新渲染当前页
      showChapter(ebookState.currentIndex);
    });
  }

  // 目录
  const tocItems = [`<div class="toc-item active" data-index="0">📖 封面</div>`];
  data.chapters.forEach((c, i) => {
    tocItems.push(`<div class="toc-item" data-index="${i + 1}">${i + 1}. ${escapeHtml(c.title)}</div>`);
  });
  $('toc').innerHTML = tocItems.join('');
  $('toc').querySelectorAll('.toc-item').forEach(item => {
    item.addEventListener('click', () => {
      showChapter(parseInt(item.dataset.index, 10));
      $('sidebar').classList.remove('open');
    });
  });

  showChapter(0);
}

function showChapter(index) {
  const data = ebookState.data;
  if (!data) return;
  ebookState.currentIndex = index;
  $('ebookContent').scrollTop = 0;

  if (index === 0) {
    $('ebookContent').innerHTML = `
      <div class="cover-page">
        <img src="${data.cover || ''}" alt="封面" onerror="this.style.display='none'" />
        <h1>${escapeHtml(data.title)}</h1>
        ${data.author ? `<p class="author">${escapeHtml(data.author)}</p>` : ''}
        <p class="hint">👆 点击左上角 ☰ 打开目录</p>
        <p class="hint">👆 点击右上角 ⚙ 调节字号/配色/行距</p>
      </div>
    `;
  } else {
    const ch = data.chapters[index - 1];
    $('ebookContent').innerHTML = `
      <h1 class="chapter-title">${escapeHtml(ch.title)}</h1>
      ${ch.content}
    `;
  }

  // 高亮目录
  $('toc').querySelectorAll('.toc-item').forEach(item => {
    item.classList.toggle('active', parseInt(item.dataset.index, 10) === index);
  });

  $('progress').textContent = `${index + 1} / ${data.chapters.length + 1}`;
  $('prevBtn').disabled = index === 0;
  $('nextBtn').disabled = index === data.chapters.length;
}

// 上一节 / 下一节
$('prevBtn').addEventListener('click', () => {
  if (ebookState.currentIndex > 0) showChapter(ebookState.currentIndex - 1);
});
$('nextBtn').addEventListener('click', () => {
  if (ebookState.data && ebookState.currentIndex < ebookState.data.chapters.length) {
    showChapter(ebookState.currentIndex + 1);
  }
});

// 键盘 ← → 翻页
document.addEventListener('keydown', (e) => {
  if (!$('ebook-view').classList.contains('active')) return;
  if (e.key === 'ArrowLeft' && ebookState.currentIndex > 0) showChapter(ebookState.currentIndex - 1);
  if (e.key === 'ArrowRight' && ebookState.data && ebookState.currentIndex < ebookState.data.chapters.length) {
    showChapter(ebookState.currentIndex + 1);
  }
  if (e.key === 'Escape') {
    $('sidebar').classList.remove('open');
    $('settingsPanel').classList.remove('open');
  }
});

// 侧栏：目录 / 设置
$('menuBtn').addEventListener('click', () => $('sidebar').classList.add('open'));
$('closeSidebar').addEventListener('click', () => $('sidebar').classList.remove('open'));
$('settingsBtn').addEventListener('click', () => $('settingsPanel').classList.add('open'));
$('closeSettings').addEventListener('click', () => $('settingsPanel').classList.remove('open'));

// 设置：字号 / 主题 / 行距
function updateEbookFrame() {
  const f = $('ebookFrame');
  const font = document.querySelector('.font-controls button.active')?.dataset.size || 'medium';
  const theme = document.querySelector('.theme-controls button.active')?.dataset.theme || 'light';
  const line = document.querySelector('.line-controls button.active')?.dataset.line || 'normal';
  f.className = `ebook-frame font-${font} theme-${theme} line-${line}`;
}
document.querySelectorAll('.font-controls button').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.font-controls button').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    updateEbookFrame();
  });
});
document.querySelectorAll('.theme-controls button').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.theme-controls button').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    updateEbookFrame();
  });
});
document.querySelectorAll('.line-controls button').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.line-controls button').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    updateEbookFrame();
  });
});

// ============== 初始化 ==============
function init() {
  setupUpload();
  setupCoverTabs();
  setupMoreSettings();
  // 结果弹层关闭
  $('resultClose').addEventListener('click', () => hide('resultModal'));
  $('resetBtn').addEventListener('click', resetAll);
  handleRoute();
}
init();

function resetAll() {
  state.file = null;
  state.fileName = '';
  state.fileText = '';
  state.coverImage = null;
  state.aiCoverUrl = null;
  state.bookTitle = '';
  state.bookAuthor = '';
  state.ebookData = null;
  $('fileInput').value = '';
  $('coverInput').value = '';
  $('fileInfo').classList.add('hidden');
  $('wordCountWarn').classList.add('hidden');
  $('bookTitle').value = '';
  $('bookAuthor').value = '';
  $('uploadCoverPreview').innerHTML = '<span class="placeholder">未选择图片</span>';
  $('bookCoverInner').innerHTML = '<div class="cover-placeholder"><div class="placeholder-icon">📖</div><p>上传文档后<br>在此预览封面</p></div>';
  $('thumbCover').innerHTML = '<div class="thumb-placeholder">封面</div>';
  $('thumbToc').innerHTML = '<div class="thumb-placeholder">目录</div>';
  $('thumbPage').innerHTML = '<div class="thumb-placeholder">内页</div>';
  $('thumbQr').innerHTML = '<div class="thumb-placeholder">分享</div>';
  $('metaFilename').textContent = '未选择';
  $('metaWords').textContent = '—';
  $('metaTime').textContent = '约 1 分钟';
  $('step2').classList.add('disabled');
  $('step3').classList.add('disabled');
  $('generateBtn').disabled = true;
  setStatus('idle', '等待上传');
  hide('resultModal');
  window.scrollTo({ top: 0, behavior: 'smooth' });
}
