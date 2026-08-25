// ========== 数据存储（IndexedDB） ==========
const DB_NAME = 'InsuranceKB';
const DB_VERSION = 1;
const STORE_NAME = 'entries';

let db;

function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      db = request.result;
      resolve(db);
    };
    request.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true });
        store.createIndex('type', 'type', { unique: false });
        store.createIndex('tags', 'tags', { unique: false, multiEntry: true });
        store.createIndex('createdAt', 'createdAt', { unique: false });
      }
    };
  });
}

// ========== 智能结构化（模拟LLM，后续可替换为API调用） ==========
function parseInput(text) {
  // 简单规则引擎，后续可替换为 LLM API
  const result = {
    raw: text,
    type: 'knowledge',
    title: '',
    content: '',
    objection: '',
    response: '',
    tags: [],
    createdAt: new Date().toISOString()
  };

  // 判断类型
  if (text.includes('客户说') || text.includes('异议') || text.includes('拒绝')) {
    result.type = 'objection';
    result.tags.push('异议处理');
  } else if (text.includes('案例') || text.includes('成交') || text.includes('签单')) {
    result.type = 'case';
    result.tags.push('成功案例');
  } else {
    result.type = 'knowledge';
    result.tags.push('知识点');
  }

  // 提取异议和应对
  const objectionMatch = text.match(/客户[说：:]\s*[""](.+?)[""]/);
  if (objectionMatch) {
    result.objection = objectionMatch[1];
  }

  // 提取数字列表（应对话术）
  const points = text.match(/\d+[、.]\s*(.+)/g);
  if (points) {
    result.response = points.map(p => p.replace(/^\d+[、.]\s*/, '')).join('\n');
  }

  // 标题
  result.title = text.slice(0, 30) + (text.length > 30 ? '...' : '');
  result.content = text;

  // 自动标签
  if (text.includes('团险')) result.tags.push('团险');
  if (text.includes('重疾')) result.tags.push('重疾险');
  if (text.includes('医疗')) result.tags.push('医疗险');
  if (text.includes('意外')) result.tags.push('意外险');
  if (text.includes('程序员') || text.includes('IT')) result.tags.push('程序员');

  return result;
}

// ========== UI 交互 ==========
document.getElementById('btn-submit').addEventListener('click', async () => {
  const text = document.getElementById('input-text').value.trim();
  if (!text) {
    alert('请输入内容');
    return;
  }

  document.getElementById('status').textContent = '处理中...';
  
  // 模拟处理延迟
  setTimeout(() => {
    const parsed = parseInput(text);
    displayResult(parsed);
    document.getElementById('status').textContent = '就绪';
    document.getElementById('result-area').style.display = 'block';
    document.getElementById('result-area').scrollIntoView({ behavior: 'smooth' });
  }, 800);
});

function displayResult(data) {
  const card = document.getElementById('result-card');
  card.innerHTML = `
    <div class="field">
      <div class="field-label">类型</div>
      <div class="field-value">${getTypeLabel(data.type)}</div>
    </div>
    <div class="field">
      <div class="field-label">标题</div>
      <div class="field-value">${data.title}</div>
    </div>
    ${data.objection ? `
    <div class="field">
      <div class="field-label">客户异议</div>
      <div class="field-value">${data.objection}</div>
    </div>` : ''}
    ${data.response ? `
    <div class="field">
      <div class="field-label">应对话术</div>
      <div class="field-value">${data.response.replace(/\n/g, '<br>')}</div>
    </div>` : ''}
    <div class="field">
      <div class="field-label">标签</div>
      <div class="field-value">${data.tags.map(t => `#${t}`).join(' ')}</div>
    </div>
  `;
  card.dataset.parsed = JSON.stringify(data);
}

function getTypeLabel(type) {
  const map = { objection: '🗣️ 异议处理', case: '✅ 成功案例', knowledge: '📖 知识点' };
  return map[type] || type;
}

document.getElementById('btn-save').addEventListener('click', async () => {
  const card = document.getElementById('result-card');
  const data = JSON.parse(card.dataset.parsed);
  
  const tx = db.transaction(STORE_NAME, 'readwrite');
  const store = tx.objectStore(STORE_NAME);
  store.add(data);
  
  tx.oncomplete = () => {
    alert('✅ 保存成功！');
    document.getElementById('input-text').value = '';
    document.getElementById('result-area').style.display = 'none';
    loadItems();
  };
});

// ========== 搜索和列表 ==========
async function loadItems(typeFilter = 'all') {
  const tx = db.transaction(STORE_NAME, 'readonly');
  const store = tx.objectStore(STORE_NAME);
  const request = store.getAll();
  
  request.onsuccess = () => {
    let items = request.result;
    if (typeFilter !== 'all') {
      items = items.filter(i => i.type === typeFilter);
    }
    items.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    renderItems(items);
  };
}

function renderItems(items) {
  const container = document.getElementById('item-list');
  if (items.length === 0) {
    container.innerHTML = '<p style="color:#9ca3af;font-size:14px;">暂无素材，去录入一条吧</p>';
    return;
  }
  container.innerHTML = items.map(item => `
    <div class="item">
      <div style="font-weight:600;font-size:14px;margin-bottom:4px;">${getTypeLabel(item.type)} ${item.title}</div>
      <div style="font-size:13px;color:#6b7280;">${item.content.slice(0, 60)}...</div>
      <div class="tags">${item.tags.map(t => `<span class="tag">#${t}</span>`).join('')}</div>
    </div>
  `).join('');
}

document.querySelectorAll('.tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    loadItems(tab.dataset.type);
  });
});

document.getElementById('btn-search').addEventListener('click', () => {
  const keyword = document.getElementById('search-input').value.trim().toLowerCase();
  if (!keyword) { loadItems(); return; }
  
  const tx = db.transaction(STORE_NAME, 'readonly');
  const store = tx.objectStore(STORE_NAME);
  const request = store.getAll();
  request.onsuccess = () => {
    const results = request.result.filter(item => 
      item.content.toLowerCase().includes(keyword) ||
      item.tags.some(t => t.toLowerCase().includes(keyword)) ||
      (item.objection && item.objection.toLowerCase().includes(keyword))
    );
    renderItems(results);
  };
});

// ========== 语音录入（Web Speech API） ==========
document.getElementById('btn-voice').addEventListener('click', () => {
  if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
    alert('当前浏览器不支持语音识别，请使用 Chrome/Edge 浏览器');
    return;
  }
  
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  const recognition = new SpeechRecognition();
  recognition.lang = 'zh-CN';
  recognition.continuous = false;
  recognition.interimResults = false;
  
  recognition.onstart = () => {
    document.getElementById('btn-voice').textContent = '🎙️ 录音中...';
  };
  
  recognition.onresult = (e) => {
    const text = e.results[0][0].transcript;
    document.getElementById('input-text').value += text;
    document.getElementById('btn-voice').textContent = '🎤 语音录入';
  };
  
  recognition.onerror = () => {
    document.getElementById('btn-voice').textContent = '🎤 语音录入';
    alert('语音识别失败，请重试');
  };
  
  recognition.start();
});

// ========== 初始化 ==========
openDB().then(() => {
  loadItems();
  document.getElementById('status').textContent = '就绪';
});

// ========== Service Worker 注册 ==========
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js');
}