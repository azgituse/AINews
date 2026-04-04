#!/usr/bin/env node

/**
 * AI新闻抓取脚本 - 真实数据源版
 * 抓取中文权威AI媒体的RSS源
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');
const { URL } = require('url');
const Parser = require('rss-parser');
const cheerio = require('cheerio');

// 配置文件路径
const DATA_DIR = path.join(__dirname, 'data');
const ARTICLES_FILE = path.join(DATA_DIR, 'articles.json');

// 创建RSS解析器实例
const parser = new Parser({
    timeout: 10000,
    maxRedirects: 3,
    headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    }
});

// 权威AI新闻源配置
const NEWS_SOURCES = [
    {
        name: '量子位',
        url: 'https://www.qbitai.com/feed/',
        enabled: true,
        description: '以"有趣有料"著称的AI新媒体'
    },
    {
        name: '机器之心',
        url: 'https://www.jiqizhixin.com/rss',
        enabled: false,
        description: '国内最具影响力的AI科技媒体（RSS暂时不可用）'
    },
    {
        name: '雷锋网',
        url: 'https://www.leiphone.com/feed',
        enabled: true,
        description: '综合性科技媒体的AI垂直频道'
    },
    {
        name: '36氪',
        url: 'https://36kr.com/feed',
        enabled: true,
        description: '科技创业媒体'
    },
    {
        name: 'Solidot',
        url: 'https://www.solidot.org/index.rss',
        enabled: true,
        description: '科技资讯聚合'
    }
];

// AI关键词（用于过滤非AI内容）
const AI_KEYWORDS = [
    'ai', '人工智能', '机器学习', '深度学习', '神经网络', '大模型', 'llm',
    'gpt', 'chatgpt', 'claude', 'gemini', 'llama', '文心', '通义', 'kimi',
    'openai', 'anthropic', 'google ai', 'meta ai', '微软', '百度', '阿里', '腾讯',
    '机器人', '具身智能', '自动驾驶', '计算机视觉', 'nlp', '自然语言',
    '生成式', 'aigc', '多模态', 'transformer', 'diffusion', 'agent',
    '芯片', 'gpu', '英伟达', 'nvidia', '算力', '训练', '推理', 'api'
];

// 判断是否是AI相关内容
function isAIContent(title, summary) {
    const text = (title + ' ' + summary).toLowerCase();
    return AI_KEYWORDS.some(keyword => text.includes(keyword.toLowerCase()));
}

// 确保数据目录存在
function ensureDataDir() {
    if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
    }
}

// 获取现有文章
function getExistingArticles() {
    try {
        if (fs.existsSync(ARTICLES_FILE)) {
            const data = fs.readFileSync(ARTICLES_FILE, 'utf-8');
            return JSON.parse(data);
        }
    } catch (error) {
        console.error('读取现有文章失败:', error.message);
    }
    return [];
}

// 保存文章
function saveArticles(articles) {
    ensureDataDir();
    fs.writeFileSync(ARTICLES_FILE, JSON.stringify(articles, null, 2), 'utf-8');
    console.log(`✅ 已保存 ${articles.length} 篇文章到 ${ARTICLES_FILE}`);
}

// 生成唯一ID
function generateId(url) {
    // 使用URL的hash作为ID，更可靠
    let hash = 0;
    for (let i = 0; i < url.length; i++) {
        const char = url.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash;
    }
    return Math.abs(hash).toString(16).substring(0, 16);
}

// 提取标签
function extractTags(title, summary) {
    const tags = new Set();
    const text = (title + ' ' + summary).toLowerCase();

    // 公司/机构标签
    const companies = ['openai', 'google', 'anthropic', 'meta', '微软', '百度', '阿里', '腾讯', '字节', '华为', '小米', '商汤', '科大讯飞'];
    companies.forEach(c => {
        if (text.includes(c.toLowerCase())) tags.add(c);
    });

    // 技术标签
    const techs = ['大模型', 'gpt', 'llm', '生成式ai', '多模态', '计算机视觉', 'nlp', '强化学习', '深度学习', '神经网络', 'transformer', 'aigc', 'agent'];
    techs.forEach(t => {
        if (text.includes(t.toLowerCase())) tags.add(t);
    });

    // 应用领域
    const fields = ['医疗', '金融', '教育', '自动驾驶', '机器人', '芯片', '搜索', '编程', '设计', '游戏'];
    fields.forEach(f => {
        if (text.includes(f)) tags.add(f);
    });

    return Array.from(tags).slice(0, 4);
}

// 获取网页完整内容
async function fetchFullContent(url, sourceName) {
    return new Promise((resolve) => {
        try {
            const parsedUrl = new URL(url);
            const client = parsedUrl.protocol === 'https:' ? https : http;

            const req = client.get(url, {
                timeout: 10000,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
                }
            }, (res) => {
                if (res.statusCode !== 200) {
                    resolve(null);
                    return;
                }

                let data = '';
                res.on('data', chunk => data += chunk);
                res.on('end', () => {
                    try {
                        const $ = cheerio.load(data);
                        let content = '';

                        // 根据不同网站选择不同的内容选择器
                        if (sourceName === '量子位') {
                            content = $('.post-content').text() || $('.entry-content').text() || $('article').text();
                        } else if (sourceName === '雷锋网') {
                            content = $('.article-content').text() || $('.post-content').text() || $('article').text();
                        } else if (sourceName === '36氪') {
                            content = $('.article-content').text() || $('.post-content').text() || $('article').text();
                        } else {
                            // 通用选择器
                            content = $('article').text() || $('.content').text() || $('.post').text() || $('main').text();
                        }

                        resolve(content.trim());
                    } catch (e) {
                        resolve(null);
                    }
                });
            });

            req.on('error', () => resolve(null));
            req.on('timeout', () => {
                req.destroy();
                resolve(null);
            });
        } catch (e) {
            resolve(null);
        }
    });
}

// 清理HTML标签，但保留段落结构
function cleanHtml(html) {
    if (!html) return '';
    return html
        // 将段落和换行标签转为换行符
        .replace(/<\/p>/gi, '\n\n')
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<\/div>/gi, '\n')
        // 移除其他HTML标签
        .replace(/<[^>]+>/g, '')
        // 解码HTML实体
        .replace(/&nbsp;/g, ' ')
        .replace(/&quot;/g, '"')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        // 压缩多个换行为两个换行（段落分隔）
        .replace(/\n{3,}/g, '\n\n')
        .trim();
}

// 截取摘要
function extractSummary(content, maxLength = 150) {
    const clean = cleanHtml(content);
    if (clean.length <= maxLength) return clean;
    return clean.substring(0, maxLength) + '...';
}

// 抓取单个RSS源
async function fetchFromSource(source) {
    const articles = [];

    try {
        console.log(`📡 正在抓取 [${source.name}]...`);
        console.log(`   URL: ${source.url}`);

        const feed = await parser.parseURL(source.url);
        console.log(`   ✅ 获取到 ${feed.items?.length || 0} 条RSS条目`);

        if (!feed.items || feed.items.length === 0) {
            console.log(`   ⚠️ RSS源返回空数据`);
            return articles;
        }

        for (const item of feed.items) {
            try {
                const title = cleanHtml(item.title || '');
                const url = item.link || item.guid || '';
                const pubDate = item.pubDate || item.isoDate || new Date().toISOString();
                const author = item.creator || item.author || source.name;

                // 获取RSS中的内容
                const rssContent = item.content || item['content:encoded'] || item.summary || '';
                const summary = extractSummary(rssContent);

                if (!title || !url) continue;

                // 过滤非AI内容（只对36氪、Solidot等非专业AI源）
                if (source.name === '36氪' || source.name === 'Solidot') {
                    if (!isAIContent(title, summary)) {
                        continue; // 跳过非AI内容
                    }
                }

                // 尝试抓取原文网页获取完整内容（部分网站可能无法获取）
                let fullContent = await fetchFullContent(url, source.name);

                // 如果抓取失败或内容太短，使用RSS中的内容
                if (!fullContent || fullContent.length < rssContent.length * 2) {
                    fullContent = rssContent;
                }

                const article = {
                    id: generateId(url),
                    title: title,
                    summary: summary,
                    content: fullContent ? cleanHtml(fullContent) : cleanHtml(rssContent), // 优先使用抓取的内容
                    source: source.name,
                    author: author,
                    url: url,
                    date: new Date(pubDate).toISOString(),
                    tags: extractTags(title, summary),
                    fetchedAt: new Date().toISOString()
                };

                articles.push(article);
            } catch (itemError) {
                console.log(`   ⚠️ 解析单条RSS失败: ${itemError.message}`);
            }
        }

        console.log(`   ✅ 成功解析 ${articles.length} 篇文章`);
    } catch (error) {
        console.error(`   ❌ [${source.name}] 抓取失败: ${error.message}`);
        if (error.code === 'ECONNREFUSED') {
            console.error(`      提示: 无法连接到服务器，请检查网络或RSS地址是否可用`);
        } else if (error.code === 'ETIMEDOUT') {
            console.error(`      提示: 连接超时，可能是网络问题`);
        }
    }

    return articles;
}

// 主抓取函数
async function crawl() {
    console.log('🚀 开始抓取AI新闻（真实数据源）...');
    console.log(`⏰ 当前时间: ${new Date().toLocaleString('zh-CN')}`);
    console.log('');

    const existing = getExistingArticles();
    console.log(`📚 现有文章数量: ${existing.length}`);
    console.log('');

    const newArticles = [];
    const enabledSources = NEWS_SOURCES.filter(s => s.enabled);

    console.log(`📡 将抓取 ${enabledSources.length} 个数据源:`);
    enabledSources.forEach(s => console.log(`   - ${s.name}: ${s.description}`));
    console.log('');

    for (const source of enabledSources) {
        const articles = await fetchFromSource(source);
        newArticles.push(...articles);
        console.log('');
    }

    // 合并并去重（基于URL）
    const allArticles = [...newArticles, ...existing];
    const unique = allArticles.filter((item, index, self) =>
        index === self.findIndex(t => t.id === item.id || t.url === item.url)
    );

    // 保留最近90天的文章（更宽松）
    const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
    const recent = unique.filter(a => {
        const articleDate = new Date(a.date);
        // 过滤掉未来日期（RSS可能有错误）
        return articleDate > ninetyDaysAgo && articleDate <= new Date(Date.now() + 24 * 60 * 60 * 1000);
    });

    // 按日期排序（最新的在前）
    recent.sort((a, b) => new Date(b.date) - new Date(a.date));

    saveArticles(recent);

    console.log('');
    console.log(`📊 抓取统计:`);
    console.log(`  - 本次新增: ${newArticles.length}`);
    console.log(`  - 去重后总数: ${unique.length}`);
    console.log(`  - 保留（60天内）: ${recent.length}`);
    console.log(`  - 清理过期: ${unique.length - recent.length}`);

    return {
        newCount: newArticles.length,
        totalCount: recent.length,
        bySource: enabledSources.map(s => ({
            name: s.name,
            count: newArticles.filter(a => a.source === s.name).length
        }))
    };
}

// 测试单个数据源
async function testSource(sourceName) {
    const source = NEWS_SOURCES.find(s => s.name === sourceName);
    if (!source) {
        console.error(`未找到数据源: ${sourceName}`);
        console.log(`可用数据源: ${NEWS_SOURCES.map(s => s.name).join(', ')}`);
        return;
    }

    console.log(`🧪 测试数据源: ${source.name}`);
    console.log(`URL: ${source.url}`);
    console.log('');

    const articles = await fetchFromSource(source);

    console.log('');
    console.log(`结果: 获取到 ${articles.length} 篇文章`);

    if (articles.length > 0) {
        console.log('');
        console.log('最新一篇文章示例:');
        const sample = articles[0];
        console.log(`  标题: ${sample.title}`);
        console.log(`  时间: ${sample.date}`);
        console.log(`  链接: ${sample.url}`);
        console.log(`  标签: ${sample.tags.join(', ')}`);
    }
}

// 命令行参数处理
const args = process.argv.slice(2);

if (args.includes('--test') && args[args.indexOf('--test') + 1]) {
    // 测试模式: node crawler.js --test 机器之心
    testSource(args[args.indexOf('--test') + 1])
        .then(() => process.exit(0))
        .catch(error => {
            console.error('测试失败:', error);
            process.exit(1);
        });
} else if (args.includes('--list')) {
    // 列出数据源
    console.log('📋 可用数据源列表:');
    NEWS_SOURCES.forEach((s, i) => {
        console.log(`\n${i + 1}. ${s.name}`);
        console.log(`   描述: ${s.description}`);
        console.log(`   URL: ${s.url}`);
        console.log(`   状态: ${s.enabled ? '✅ 启用' : '❌ 禁用'}`);
    });
    process.exit(0);
} else {
    // 正常抓取模式
    crawl()
        .then(result => {
            console.log('');
            console.log('✨ 抓取完成！');
            console.log('');
            console.log('各源新增文章数:');
            result.bySource.forEach(s => {
                console.log(`  - ${s.name}: ${s.count} 篇`);
            });
            process.exit(0);
        })
        .catch(error => {
            console.error('💥 抓取失败:', error);
            process.exit(1);
        });
}

module.exports = { crawl, NEWS_SOURCES, testSource };
