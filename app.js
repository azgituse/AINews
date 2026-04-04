// 数据存储管理
const Storage = {
    ARTICLES: 'ai_news_articles',
    FAVORITES: 'ai_news_favorites',
    SOURCES: 'ai_news_sources',
    LAST_UPDATE: 'ai_news_last_update',

    get(key) {
        try {
            return JSON.parse(localStorage.getItem(key)) || [];
        } catch {
            return [];
        }
    },

    set(key, value) {
        localStorage.setItem(key, JSON.stringify(value));
    },

    getArticles() {
        return this.get(this.ARTICLES);
    },

    setArticles(articles) {
        this.set(this.ARTICLES, articles);
    },

    getFavorites() {
        return this.get(this.FAVORITES);
    },

    setFavorites(favorites) {
        this.set(this.FAVORITES, favorites);
    },

    toggleFavorite(articleId) {
        const favorites = this.getFavorites();
        const index = favorites.indexOf(articleId);
        if (index > -1) {
            favorites.splice(index, 1);
        } else {
            favorites.push(articleId);
        }
        this.setFavorites(favorites);
        return favorites.includes(articleId);
    },

    isFavorite(articleId) {
        return this.getFavorites().includes(articleId);
    },

    getSources() {
        const defaultSources = [
            { id: '1', name: '量子位', url: 'https://www.qbitai.com/feed', enabled: true },
            { id: '2', name: '雷锋网', url: 'https://www.leiphone.com/feed', enabled: true },
            { id: '3', name: '36氪', url: 'https://36kr.com/feed', enabled: true },
            { id: '4', name: 'Solidot', url: 'https://www.solidot.org/index.rss', enabled: true }
        ];
        const saved = this.get(this.SOURCES);
        return saved.length > 0 ? saved : defaultSources;
    },

    setSources(sources) {
        this.set(this.SOURCES, sources);
    },

    getLastUpdate() {
        return localStorage.getItem(this.LAST_UPDATE) || null;
    },

    setLastUpdate(time) {
        localStorage.setItem(this.LAST_UPDATE, time);
    }
};

// 应用状态
let currentView = 'today';
let currentArticle = null;
let searchQuery = '';
let currentPage = 1;
const PAGE_SIZE = 20;

// 初始化
async function init() {
    console.log('初始化AI新闻追踪...');

    // 清除旧的localStorage数据，强制重新加载
    localStorage.removeItem('ai_news_articles');
    localStorage.removeItem('ai_news_sources');

    // 加载数据
    await loadArticlesFromJSON();

    const articles = Storage.getArticles();
    console.log('加载后文章数量:', articles.length);
    if (articles.length > 0) {
        console.log('第一篇文章:', articles[0].title, articles[0].date);
    }

    initMenu();
    initSearch();
    updateStats();
    renderArticles();
    updateLastUpdateTime();
}

// 从JSON文件加载文章
async function loadArticlesFromJSON() {
    try {
        console.log('开始加载JSON数据...');
        const response = await fetch('data/articles.json');
        console.log('Fetch响应:', response.status, response.ok);

        if (response.ok) {
            const articles = await response.json();
            console.log('解析JSON成功，文章数:', articles.length);

            if (articles && articles.length > 0) {
                // 直接设置文章，覆盖localStorage中的数据
                Storage.setArticles(articles);
                console.log('已保存到Storage');
            } else {
                console.log('JSON数据为空');
            }
        } else {
            console.error('Fetch失败:', response.status);
        }
    } catch (error) {
        console.error('从JSON加载文章失败:', error.message);
    }
}

// 初始化菜单
function initMenu() {
    const menuItems = document.querySelectorAll('.menu-item');
    menuItems.forEach(item => {
        item.addEventListener('click', () => {
            menuItems.forEach(m => m.classList.remove('active'));
            item.classList.add('active');
            currentView = item.dataset.view;
            handleViewChange();
        });
    });
}

// 处理视图切换
function handleViewChange() {
    const titles = {
        today: '最新AI动态',
        favorites: '我的收藏',
        all: '全部文章',
        sources: '订阅源管理'
    };
    document.getElementById('pageTitle').textContent = titles[currentView];

    if (currentView === 'sources') {
        document.querySelector('.content').style.display = 'none';
        document.getElementById('sourcesModal').classList.add('active');
        renderSources();
    } else {
        document.querySelector('.content').style.display = 'block';
        document.getElementById('sourcesModal').classList.remove('active');
        currentPage = 1; // 重置页码
        renderArticles();
    }
}

// 初始化搜索
function initSearch() {
    const searchInput = document.getElementById('searchInput');
    const searchClear = document.getElementById('searchClear');

    searchInput.addEventListener('input', (e) => {
        searchQuery = e.target.value.toLowerCase();
        currentPage = 1; // 重置页码
        renderArticles();

        // 控制清空按钮显示
        if (searchClear) {
            if (e.target.value) {
                searchClear.classList.add('show');
            } else {
                searchClear.classList.remove('show');
            }
        }
    });
}

// 清空搜索
function clearSearch() {
    const searchInput = document.getElementById('searchInput');
    const searchClear = document.getElementById('searchClear');

    searchInput.value = '';
    searchQuery = '';
    currentPage = 1;

    if (searchClear) {
        searchClear.classList.remove('show');
    }

    renderArticles();
    searchInput.focus();
}

// 获取筛选后的文章
function getFilteredArticles() {
    let articles = Storage.getArticles();

    // 按视图筛选
    if (currentView === 'today') {
        // 显示最近7天的文章
        const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        articles = articles.filter(a => new Date(a.date) >= sevenDaysAgo);
    } else if (currentView === 'favorites') {
        const favorites = Storage.getFavorites();
        articles = articles.filter(a => favorites.includes(a.id));
    }

    // 搜索筛选
    if (searchQuery) {
        articles = articles.filter(a =>
            a.title.toLowerCase().includes(searchQuery) ||
            a.summary.toLowerCase().includes(searchQuery) ||
            a.tags.some(t => t.toLowerCase().includes(searchQuery))
        );
    }

    // 按日期排序
    return articles.sort((a, b) => new Date(b.date) - new Date(a.date));
}

// 渲染文章列表
function renderArticles() {
    const container = document.getElementById('articlesContainer');
    const allArticles = Storage.getArticles();
    const articles = getFilteredArticles();

    console.log('渲染文章:', {
        all: allArticles.length,
        filtered: articles.length,
        view: currentView,
        page: currentPage
    });

    if (articles.length === 0) {
        container.innerHTML = `
            <div class="empty-state" style="grid-column: 1 / -1;">
                <i class="fas fa-inbox"></i>
                <h3>暂无文章</h3>
                <p>${currentView === 'favorites' ? '还没有收藏任何文章' : '还没有文章数据，点击刷新按钮获取'}</p>
            </div>
        `;
        return;
    }

    // 计算分页
    const totalPages = Math.ceil(articles.length / PAGE_SIZE);
    const startIndex = (currentPage - 1) * PAGE_SIZE;
    const endIndex = startIndex + PAGE_SIZE;
    const pageArticles = articles.slice(startIndex, endIndex);

    let html = pageArticles.map(article => `
        <div class="article-card" onclick="openArticle('${article.id}')">
            <button class="article-favorite ${Storage.isFavorite(article.id) ? 'active' : ''}"
                    onclick="toggleFavorite(event, '${article.id}')">
                <i class="${Storage.isFavorite(article.id) ? 'fas' : 'far'} fa-star"></i>
            </button>
            <div class="article-content">
                <div class="article-main-row">
                    <span class="article-source">
                        <i class="fas fa-globe"></i> ${article.source}
                    </span>
                    <h3 class="article-title">${article.title}</h3>
                </div>
                <div class="article-meta-row">
                    <p class="article-summary">${article.summary}</p>
                    <div class="article-meta">
                        <span><i class="fas fa-clock"></i> ${formatTime(article.date)}</span>
                        <span><i class="fas fa-user"></i> ${article.author || '未知'}</span>
                    </div>
                    <div class="article-tags">
                        ${article.tags.slice(0, 3).map(tag => `<span class="tag">${tag}</span>`).join('')}
                    </div>
                </div>
            </div>
        </div>
    `).join('');

    // 添加分页导航
    if (totalPages > 1) {
        html += renderPagination(totalPages, articles.length);
    }

    container.innerHTML = html;
}

// 渲染分页导航
function renderPagination(totalPages, totalItems) {
    let pageButtons = [];

    // 上一页按钮（带文字）
    pageButtons.push(`
        <button class="page-btn ${currentPage === 1 ? 'disabled' : ''}"
                onclick="goToPage(${currentPage - 1})"
                ${currentPage === 1 ? 'disabled' : ''}
                title="上一页">
            <i class="fas fa-chevron-left"></i> <span class="page-text">上一页</span>
        </button>
    `);

    // 页码按钮
    const maxVisible = 5;
    let startPage = Math.max(1, currentPage - Math.floor(maxVisible / 2));
    let endPage = Math.min(totalPages, startPage + maxVisible - 1);

    if (endPage - startPage < maxVisible - 1) {
        startPage = Math.max(1, endPage - maxVisible + 1);
    }

    if (startPage > 1) {
        pageButtons.push(`<button class="page-btn" onclick="goToPage(1)">1</button>`);
        if (startPage > 2) {
            pageButtons.push(`<span class="page-ellipsis">...</span>`);
        }
    }

    for (let i = startPage; i <= endPage; i++) {
        pageButtons.push(`
            <button class="page-btn ${i === currentPage ? 'active' : ''}"
                    onclick="goToPage(${i})">
                ${i}
            </button>
        `);
    }

    if (endPage < totalPages) {
        if (endPage < totalPages - 1) {
            pageButtons.push(`<span class="page-ellipsis">...</span>`);
        }
        pageButtons.push(`<button class="page-btn" onclick="goToPage(${totalPages})">${totalPages}</button>`);
    }

    // 下一页按钮（带文字）
    pageButtons.push(`
        <button class="page-btn ${currentPage === totalPages ? 'disabled' : ''}"
                onclick="goToPage(${currentPage + 1})"
                ${currentPage === totalPages ? 'disabled' : ''}
                title="下一页">
            <span class="page-text">下一页</span> <i class="fas fa-chevron-right"></i>
        </button>
    `);

    return `
        <div class="pagination">
            <div class="page-info">共 ${totalItems} 条，第 ${currentPage}/${totalPages} 页</div>
            <div class="page-buttons">${pageButtons.join('')}</div>
        </div>
    `;
}

// 跳转到指定页
function goToPage(page) {
    if (page < 1) return;
    const articles = getFilteredArticles();
    const totalPages = Math.ceil(articles.length / PAGE_SIZE);
    if (page > totalPages) return;

    currentPage = page;
    renderArticles();

    // 滚动到列表顶部
    document.querySelector('.content').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// 打开文章详情
function openArticle(id) {
    const article = Storage.getArticles().find(a => a.id === id);
    if (!article) return;

    currentArticle = article;

    document.getElementById('modalTitle').textContent = article.title;
    document.getElementById('modalSource').innerHTML = `<i class="fas fa-globe"></i> ${article.source}`;
    document.getElementById('modalDate').innerHTML = `<i class="fas fa-clock"></i> ${formatDate(article.date)}`;
    document.getElementById('modalAuthor').innerHTML = `<i class="fas fa-user"></i> ${article.author || '未知'}`;
    // 显示完整内容，如果没有则显示摘要
    document.getElementById('modalSummary').textContent = article.content || article.summary;
    document.getElementById('modalLink').href = article.url;

    const favoriteBtn = document.getElementById('modalFavorite');
    const isFav = Storage.isFavorite(article.id);
    favoriteBtn.innerHTML = `<i class="${isFav ? 'fas' : 'far'} fa-star"></i>`;
    favoriteBtn.classList.toggle('active', isFav);
    favoriteBtn.onclick = () => {
        const nowFav = Storage.toggleFavorite(article.id);
        favoriteBtn.innerHTML = `<i class="${nowFav ? 'fas' : 'far'} fa-star"></i>`;
        favoriteBtn.classList.toggle('active', nowFav);
        renderArticles();
        updateStats();
    };

    document.getElementById('modalTags').innerHTML = article.tags
        .map(tag => `<span class="tag">${tag}</span>`)
        .join('');

    document.getElementById('articleModal').classList.add('active');
}

// 关闭模态框
function closeModal() {
    document.getElementById('articleModal').classList.remove('active');
}

function closeSourcesModal() {
    document.getElementById('sourcesModal').classList.remove('active');
    currentView = 'today';
    document.querySelector('.menu-item[data-view="today"]').click();
}

// 切换收藏状态
function toggleFavorite(event, id) {
    event.stopPropagation();
    Storage.toggleFavorite(id);
    renderArticles();
    updateStats();
}

// 渲染订阅源列表
function renderSources() {
    const sources = Storage.getSources();
    const container = document.getElementById('sourcesList');

    container.innerHTML = sources.map(source => `
        <div class="source-item">
            <div class="source-info">
                <h4>${source.name}</h4>
                <p>${source.url}</p>
            </div>
            <div class="source-actions">
                <button onclick="deleteSource('${source.id}')">
                    <i class="fas fa-trash"></i> 删除
                </button>
            </div>
        </div>
    `).join('');
}

// 添加订阅源
function addSource() {
    const nameInput = document.getElementById('sourceName');
    const urlInput = document.getElementById('sourceUrl');

    const name = nameInput.value.trim();
    const url = urlInput.value.trim();

    if (!name || !url) {
        alert('请填写完整信息');
        return;
    }

    const sources = Storage.getSources();
    sources.push({
        id: Date.now().toString(),
        name,
        url,
        enabled: true
    });

    Storage.setSources(sources);
    nameInput.value = '';
    urlInput.value = '';
    renderSources();
}

// 删除订阅源
function deleteSource(id) {
    const sources = Storage.getSources().filter(s => s.id !== id);
    Storage.setSources(sources);
    renderSources();
}

// 刷新新闻
async function refreshNews() {
    const btn = document.querySelector('.btn-refresh i');
    btn.classList.add('fa-spin');

    try {
        // 获取新文章
        const newArticles = await fetchNews();

        // 合并并去重
        const existing = Storage.getArticles();
        const merged = [...newArticles, ...existing];
        const unique = merged.filter((item, index, self) =>
            index === self.findIndex(t => t.id === item.id || t.url === item.url)
        );

        Storage.setArticles(unique);
        Storage.setLastUpdate(new Date().toISOString());

        renderArticles();
        updateStats();
        updateLastUpdateTime();

        alert(`成功获取 ${newArticles.length} 篇新文章！`);
    } catch (error) {
        console.error('刷新失败:', error);
        alert('刷新失败，请稍后重试');
    } finally {
        btn.classList.remove('fa-spin');
    }
}

// 模拟获取新闻
async function fetchNews() {
    // 这里是模拟数据，实际使用时需要调用真实API或RSS
    const mockArticles = [
        {
            id: Date.now().toString() + '1',
            title: 'OpenAI发布GPT-5预告：多模态能力大幅提升',
            summary: 'OpenAI今日发布博客文章，预告下一代GPT模型将在多模态理解方面有重大突破，同时推理成本降低40%，预计在Q2季度末正式发布...',
            source: '机器之心',
            author: 'AI前沿',
            url: 'https://example.com/1',
            date: new Date().toISOString(),
            tags: ['OpenAI', 'GPT-5', '大模型']
        },
        {
            id: Date.now().toString() + '2',
            title: 'Google DeepMind推出新一代机器人控制模型',
            summary: 'DeepMind团队发布了RT-3模型，能够在真实环境中完成复杂的家庭任务，成功率达到92%，这是具身智能领域的重大进展...',
            source: '量子位',
            author: '量子位',
            url: 'https://example.com/2',
            date: new Date().toISOString(),
            tags: ['DeepMind', '机器人', '具身智能']
        },
        {
            id: Date.now().toString() + '3',
            title: 'AI芯片市场迎来新玩家，国产7nm芯片量产',
            summary: '国内芯片厂商今日宣布7nm AI训练芯片正式量产，性能对标NVIDIA H100，功耗降低20%，已有头部云厂商开始测试...',
            source: 'AI科技评论',
            author: '雷峰网',
            url: 'https://example.com/3',
            date: new Date().toISOString(),
            tags: ['AI芯片', '国产芯片', 'NVIDIA']
        }
    ];

    // 随机返回1-3条
    const count = Math.floor(Math.random() * 3) + 1;
    return mockArticles.slice(0, count);
}

// 加载示例数据
function loadDemoData() {
    const demoArticles = [
        {
            id: 'demo1',
            title: 'Claude Code正式发布：AI编程助手新时代',
            summary: 'Anthropic正式发布Claude Code，这是一个集成在命令行中的AI编程助手，能够理解大型代码库，帮助开发者快速完成复杂的开发任务...',
            source: '机器之心',
            author: 'AI前线',
            url: 'https://www.jiqizhixin.com/',
            date: new Date().toISOString(),
            tags: ['Claude', '编程助手', 'Anthropic']
        },
        {
            id: 'demo2',
            title: 'Sora正式向公众开放，视频生成进入实用阶段',
            summary: 'OpenAI宣布Sora开始向ChatGPT Plus和Pro用户开放，支持生成最高1080p、最长20秒的视频，标志着AI视频生成从概念走向实用...',
            source: '量子位',
            author: '量子位',
            url: 'https://www.qbitai.com/',
            date: new Date(Date.now() - 86400000).toISOString(),
            tags: ['Sora', 'OpenAI', '视频生成']
        },
        {
            id: 'demo3',
            title: 'Meta发布Llama 3.1 405B：开源大模型新标杆',
            summary: 'Meta发布迄今最大规模的开源模型Llama 3.1 405B，参数量达4050亿，在多项基准测试中接近甚至超越GPT-4o，并允许商业使用...',
            source: 'AI科技评论',
            author: '雷峰网',
            url: 'https://www.leiphone.com/',
            date: new Date(Date.now() - 172800000).toISOString(),
            tags: ['Meta', 'Llama', '开源模型']
        },
        {
            id: 'demo4',
            title: 'Midjourney V7发布：图像生成质量再提升',
            summary: 'Midjourney发布V7版本，在人物手部生成、文字渲染、多物体一致性等方面有重大改进，同时推出个性化风格微调功能...',
            source: '36氪AI',
            author: '36氪',
            url: 'https://36kr.com/',
            date: new Date(Date.now() - 259200000).toISOString(),
            tags: ['Midjourney', '图像生成', 'AIGC']
        },
        {
            id: 'demo5',
            title: 'Figure发布Figure 02人形机器人，进厂打工',
            summary: 'Figure公司发布第二代通用人形机器人Figure 02，已开始在宝马工厂进行测试，能够执行复杂的装配任务，续航超过6小时...',
            source: '机器之心',
            author: 'AI前线',
            url: 'https://www.jiqizhixin.com/',
            date: new Date().toISOString(),
            tags: ['人形机器人', 'Figure', '具身智能']
        }
    ];

    Storage.setArticles(demoArticles);
    Storage.setLastUpdate(new Date().toISOString());
    renderArticles();
    updateStats();
    updateLastUpdateTime();
}

// 更新统计数据
function updateStats() {
    const articles = Storage.getArticles();
    const today = new Date().toDateString();
    const todayCount = articles.filter(a => new Date(a.date).toDateString() === today).length;
    const favorites = Storage.getFavorites().length;

    // 如果页面有统计卡片则更新（可选）
    const todayEl = document.getElementById('todayCount');
    const totalEl = document.getElementById('totalCount');
    const favEl = document.getElementById('favCount');

    if (todayEl) todayEl.textContent = todayCount;
    if (totalEl) totalEl.textContent = articles.length;
    if (favEl) favEl.textContent = favorites;
}

// 更新最后更新时间
function updateLastUpdateTime() {
    const articles = Storage.getArticles();
    let lastUpdate = null;

    // 尝试从文章数据中获取最新的抓取时间
    if (articles.length > 0) {
        const fetchedTimes = articles
            .map(a => a.fetchedAt)
            .filter(t => t)
            .sort((a, b) => new Date(b) - new Date(a));
        if (fetchedTimes.length > 0) {
            lastUpdate = fetchedTimes[0];
        }
    }

    // 如果没有，使用localStorage中的时间
    if (!lastUpdate) {
        lastUpdate = Storage.getLastUpdate();
    }

    const updateEl = document.getElementById('lastUpdate');
    if (updateEl && lastUpdate) {
        updateEl.textContent = formatDate(new Date(lastUpdate));
    }
}

// 格式化时间
function formatTime(dateStr) {
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now - date;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 60) return `${minutes}分钟前`;
    if (hours < 24) return `${hours}小时前`;
    if (days < 7) return `${days}天前`;
    return `${date.getMonth() + 1}/${date.getDate()}`;
}

// 格式化日期
function formatDate(dateStr) {
    const date = new Date(dateStr);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

// 点击模态框外部关闭
document.getElementById('articleModal').addEventListener('click', (e) => {
    if (e.target.id === 'articleModal') closeModal();
});

// 键盘快捷键
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        closeModal();
        closeSourcesModal();
    }
    if (e.key === 'r' && e.ctrlKey) {
        e.preventDefault();
        refreshNews();
    }
});

// 启动应用
document.addEventListener('DOMContentLoaded', () => init());

// 定时刷新检测（每30分钟检查一次是否需要刷新）
setInterval(() => {
    const lastUpdate = Storage.getLastUpdate();
    if (lastUpdate) {
        const diff = new Date() - new Date(lastUpdate);
        const hours = diff / 3600000;

        // 如果超过12小时没更新，尝试自动刷新
        if (hours > 12) {
            console.log('检测到数据过期，准备自动刷新...');
            // 可选：自动刷新
            // refreshNews();
        }
    }
}, 30 * 60 * 1000);
