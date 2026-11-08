// 豆瓣热门电影电视剧推荐功能

// 豆瓣标签列表 - 修改为默认标签
let defaultMovieTags = ['热门', '最新', '经典', '豆瓣高分', '冷门佳片', '华语', '欧美', '韩国', '日本', '动作', '喜剧', '日综', '爱情', '科幻', '悬疑', '恐怖', '治愈'];
let defaultTvTags = ['热门', '美剧', '英剧', '韩剧', '日剧', '国产剧', '港剧', '日本动画', '综艺', '纪录片'];

// 用户标签列表 - 存储用户实际使用的标签（包含保留的系统标签和用户添加的自定义标签）
let movieTags = [];
let tvTags = [];

// 加载用户标签
function loadUserTags() {
    try {
        // 尝试从本地存储加载用户保存的标签
        const savedMovieTags = localStorage.getItem('userMovieTags');
        const savedTvTags = localStorage.getItem('userTvTags');
        
        // 如果本地存储中有标签数据，则使用它
        if (savedMovieTags) {
            movieTags = JSON.parse(savedMovieTags);
        } else {
            // 否则使用默认标签
            movieTags = [...defaultMovieTags];
        }
        
        if (savedTvTags) {
            tvTags = JSON.parse(savedTvTags);
        } else {
            // 否则使用默认标签
            tvTags = [...defaultTvTags];
        }
    } catch (e) {
        console.error('加载标签失败：', e);
        // 初始化为默认值，防止错误
        movieTags = [...defaultMovieTags];
        tvTags = [...defaultTvTags];
    }
}

// 保存用户标签
function saveUserTags() {
    try {
        localStorage.setItem('userMovieTags', JSON.stringify(movieTags));
        localStorage.setItem('userTvTags', JSON.stringify(tvTags));
    } catch (e) {
        console.error('保存标签失败：', e);
        showToast('保存标签失败', 'error');
    }
}

let doubanMovieTvCurrentSwitch = 'movie';
let doubanCurrentTag = '热门';
let doubanPageStart = 0;
const doubanPageSize = 16; // 一次显示的项目数量
let doubanOrbitPhase = 0;
let doubanOrbitAnimationFrame = 0;
let doubanOrbitLastFrameTime = 0;

function updateDoubanCarousel() {
    const container = document.getElementById('douban-results');
    if (!container) return;
    const cards = [...container.querySelectorAll('.film-picker-card')];
    if (!cards.length) return;
    const count = cards.length;
    const radiusX = Math.min(window.innerWidth * .36, 600);
    const radiusZ = Math.min(window.innerWidth * .24, 300);
    cards.forEach((card, index) => {
        const angle = ((index / count + doubanOrbitPhase) % 1) * Math.PI * 2;
        const facing = Math.cos(angle);
        const x = Math.sin(angle) * radiusX;
        const y = Math.sin(angle * 2) * 8;
        const z = facing * radiusZ;
        const scale = .64 + Math.max(0, facing) * .27;
        const isActive = facing > Math.cos(Math.PI / count);
        card.classList.toggle('is-active', isActive);
        card.classList.toggle('is-rear', facing < -.15);
        card.setAttribute('aria-current', isActive ? 'true' : 'false');
        card.style.zIndex = String(Math.round((facing + 1) * 50));
        card.style.opacity = String(facing < -.15 ? .18 : .38 + Math.max(0, facing) * .48);
        card.style.pointerEvents = facing < .05 ? 'none' : 'auto';
        card.dataset.orbitFacing = facing.toFixed(3);
        card.style.transform = `translate(-50%, -50%) translate3d(${x}px, ${y}px, ${z}px) scale(${scale})`;
    });
}

function startDoubanOrbit() {
    if (doubanOrbitAnimationFrame || !document.querySelector('#douban-results .film-picker-card')) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const animate = timestamp => {
        if (!isDoubanCinemaVisible()) {
            doubanOrbitAnimationFrame = 0;
            doubanOrbitLastFrameTime = 0;
            return;
        }
        const elapsed = doubanOrbitLastFrameTime ? Math.min(timestamp - doubanOrbitLastFrameTime, 50) : 0;
        doubanOrbitLastFrameTime = timestamp;
        doubanOrbitPhase = (doubanOrbitPhase + elapsed / 80000) % 1;
        updateDoubanCarousel();
        doubanOrbitAnimationFrame = requestAnimationFrame(animate);
    };
    doubanOrbitAnimationFrame = requestAnimationFrame(animate);
}

function navigateDoubanCarousel(direction) {
    const cards = document.querySelectorAll('#douban-results .film-picker-card');
    if (!cards.length) return;
    const count = cards.length;
    doubanOrbitPhase = (doubanOrbitPhase + direction / count + 1) % 1;
    updateDoubanCarousel();
}

function renderFilmSpaceWords(subjects) {
    const layer = document.getElementById('filmSpaceWords');
    if (!layer) return;
    layer.replaceChildren();
    subjects.slice(0, 8).forEach((item, index) => {
        if (!item?.title) return;
        const word = document.createElement('span');
        const angle = index * Math.PI * (3 - Math.sqrt(5));
        const endX = Math.cos(angle) * window.innerWidth * .43;
        const endY = Math.sin(angle) * window.innerHeight * .31;
        word.className = 'film-space-word';
        word.textContent = item.title;
        word.style.setProperty('--word-start-x', `${endX * .08}px`);
        word.style.setProperty('--word-start-y', `${endY * .08}px`);
        word.style.setProperty('--word-mid-x', `${endX * .55}px`);
        word.style.setProperty('--word-mid-y', `${endY * .55}px`);
        word.style.setProperty('--word-end-x', `${endX}px`);
        word.style.setProperty('--word-end-y', `${endY}px`);
        word.style.animationDelay = `${-index * 2.75}s`;
        word.style.animationDuration = `${21 + index % 4 * 1.5}s`;
        layer.appendChild(word);
    });
}

function activateDoubanCard(index, title) {
    if (Date.now() < doubanCarouselSuppressClickUntil) return;
    fillAndSearchWithDouban(title);
}

let doubanCarouselSuppressClickUntil = 0;
let doubanPointerLastX = null;
let doubanPointerStartX = null;
let doubanPointerStartY = null;
let doubanPointerType = '';
let doubanPointerDragged = false;

function isDoubanCinemaVisible() {
    const area = document.getElementById('doubanArea');
    const results = document.getElementById('resultsArea');
    return !!area && !area.classList.contains('hidden') && (!results || results.classList.contains('hidden'));
}

window.addEventListener('wheel', event => {
    if (!isDoubanCinemaVisible()) return;
    if (event.target.closest('#settingsPanel, #historyPanel, #modal, #passwordModal, #disclaimerModal, #douban-tags, #douban-movie-toggle, #douban-tv-toggle, #douban-refresh, footer, input, textarea, select')) return;
    const delta = Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.deltaY;
    if (!delta) return;
    event.preventDefault();
    doubanOrbitPhase = ((doubanOrbitPhase - delta * .00022) % 1 + 1) % 1;
    updateDoubanCarousel();
}, { passive: false });

window.addEventListener('pointerdown', event => {
    if (!isDoubanCinemaVisible() || event.button !== 0) return;
    if (event.target.closest('#settingsPanel, #historyPanel, #modal, #passwordModal, #disclaimerModal, .home-search-panel, .cinema-discovery-panel, #resultsArea, a')) return;
    doubanPointerLastX = event.clientX;
    doubanPointerStartX = event.clientX;
    doubanPointerStartY = event.clientY;
    doubanPointerType = event.pointerType;
    doubanPointerDragged = false;
});

window.addEventListener('pointermove', event => {
    if (doubanPointerLastX === null) return;
    const totalX = event.clientX - doubanPointerStartX;
    const totalY = event.clientY - doubanPointerStartY;
    if (doubanPointerType !== 'mouse') {
        if (Math.abs(totalX) < 12) return;
        if (Math.abs(totalX) < Math.abs(totalY) * 1.2) {
            if (Math.abs(totalY) > 12) doubanPointerLastX = null;
            return;
        }
    } else if (Math.abs(totalX) < 3 || Math.abs(totalX) < Math.abs(totalY) * .75) {
        return;
    }
    const delta = event.clientX - doubanPointerLastX;
    if (Math.abs(delta) > 1) {
        doubanOrbitPhase = ((doubanOrbitPhase + delta * .00026) % 1 + 1) % 1;
        doubanPointerLastX = event.clientX;
        doubanPointerDragged = true;
        updateDoubanCarousel();
    }
});

window.addEventListener('pointerup', () => {
    if (doubanPointerDragged) doubanCarouselSuppressClickUntil = Date.now() + 250;
    doubanPointerLastX = null;
    doubanPointerStartX = null;
    doubanPointerStartY = null;
    doubanPointerType = '';
});
window.addEventListener('pointercancel', () => {
    doubanPointerLastX = null;
    doubanPointerStartX = null;
    doubanPointerStartY = null;
    doubanPointerType = '';
});

window.addEventListener('click', event => {
    if (!isDoubanCinemaVisible() || event.target.closest('.film-picker-card, .home-search-panel, #searchArea button, #searchArea input, #recentSearches, header a, button, input, a, #settingsPanel, #historyPanel, footer')) return;
    const cards = [...document.querySelectorAll('#douban-results .film-picker-card')];
    const hit = cards
        .filter(card => Number(card.dataset.orbitFacing) > .05)
        .filter(card => {
            const rect = card.getBoundingClientRect();
            return event.clientX >= rect.left && event.clientX <= rect.right && event.clientY >= rect.top && event.clientY <= rect.bottom;
        })
        .sort((a, b) => Number(b.dataset.orbitFacing) - Number(a.dataset.orbitFacing))[0];
    if (!hit || Date.now() < doubanCarouselSuppressClickUntil) return;
    const titleButton = hit.querySelector('.film-card-title button');
    if (titleButton) fillAndSearchWithDouban(titleButton.textContent.trim());
});

document.addEventListener('keydown', event => {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
    if (!isDoubanCinemaVisible()) return;
    if (['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName)) return;
    navigateDoubanCarousel(event.key === 'ArrowLeft' ? -1 : 1);
});
window.addEventListener('resize', updateDoubanCarousel);
let isDoubanInitialized = false;
let isDoubanLoading = false;
let currentDoubanRequestId = 0;
let currentDoubanAbortController = null;

// 初始化豆瓣功能
function initDouban() {
    if (isDoubanInitialized) {
        updateDoubanVisibility();
        return;
    }
    isDoubanInitialized = true;

    // 设置豆瓣开关的初始状态
    const doubanToggle = document.getElementById('doubanToggle');
    if (doubanToggle) {
        const isEnabled = localStorage.getItem('doubanEnabled') !== 'false';
        doubanToggle.checked = isEnabled;
        
        // 设置开关外观
        const toggleBg = doubanToggle.nextElementSibling;
        const toggleDot = toggleBg ? toggleBg.nextElementSibling : null;
        if (isEnabled && toggleBg && toggleDot) {
            toggleBg.classList.add('bg-pink-600');
            toggleDot.classList.add('translate-x-6');
        }
        
        // 添加事件监听
        doubanToggle.addEventListener('change', function(e) {
            const isChecked = e.target.checked;
            localStorage.setItem('doubanEnabled', isChecked);
            
            // 更新开关外观
            if (toggleBg && toggleDot) {
                if (isChecked) {
                    toggleBg.classList.add('bg-pink-600');
                    toggleDot.classList.add('translate-x-6');
                } else {
                    toggleBg.classList.remove('bg-pink-600');
                    toggleDot.classList.remove('translate-x-6');
                }
            }
            
            // 更新显示状态
            updateDoubanVisibility();
        });
    }

    // 加载用户标签
    loadUserTags();

    // 渲染电影/电视剧切换
    renderDoubanMovieTvSwitch();
    
    // 渲染豆瓣标签
    renderDoubanTags();
    
    // 换一批按钮事件监听
    setupDoubanRefreshBtn();
    
    // 初始根据配置更新显示状态并按需加载内容（统一在 updateDoubanVisibility 中按需加载，避免重复发起请求）
    updateDoubanVisibility();

    // 滚动到页面顶部
    window.scrollTo(0, 0);
}

// 根据设置更新豆瓣区域的显示状态
function updateDoubanVisibility() {
    const doubanArea = document.getElementById('doubanArea');
    if (!doubanArea) return;
    
    const isEnabled = localStorage.getItem('doubanEnabled') !== 'false';
    const isSearching = document.getElementById('resultsArea') && 
        !document.getElementById('resultsArea').classList.contains('hidden');
    const discoveryPanel = document.querySelector('.cinema-discovery-panel');
    if (discoveryPanel) discoveryPanel.classList.toggle('hidden', !isEnabled || !!isSearching);
    
    // 只有在启用且没有搜索结果显示时才显示豆瓣区域
    if (isEnabled && !isSearching) {
        doubanArea.classList.remove('hidden');
        // 如果豆瓣结果为空且当前未在加载中，发起初始加载
        const resultsContainer = document.getElementById('douban-results');
        if (resultsContainer && resultsContainer.children.length === 0 && !isDoubanLoading) {
            renderRecommend(doubanCurrentTag, doubanPageSize, doubanPageStart);
        } else if (resultsContainer?.querySelector('.film-picker-card')) {
            startDoubanOrbit();
        }
    } else {
        doubanArea.classList.add('hidden');
    }
}

// 只填充搜索框，不执行搜索，让用户自主决定搜索时机
function fillSearchInput(title) {
    if (!title) return;
    
    // 安全处理标题，防止XSS
    const safeTitle = title
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
    
    const input = document.getElementById('searchInput');
    if (input) {
        input.value = safeTitle;
        
        // 聚焦搜索框，便于用户立即使用键盘操作
        input.focus();
        
        // 显示一个提示，告知用户点击搜索按钮进行搜索
        showToast('已填充搜索内容，点击搜索按钮开始搜索', 'info');
    }
}

// 填充搜索框并执行搜索
function fillAndSearch(title) {
    if (!title) return;
    
    // 安全处理标题，防止XSS
    const safeTitle = title
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
    
    const input = document.getElementById('searchInput');
    if (input) {
        input.value = safeTitle;
        search(); // 使用已有的search函数执行搜索
        
        // 同时更新浏览器URL，使其反映当前的搜索状态
        try {
            // 使用URI编码确保特殊字符能够正确显示
            const encodedQuery = encodeURIComponent(safeTitle);
            // 使用HTML5 History API更新URL，不刷新页面
            window.history.pushState(
                { search: safeTitle }, 
                `搜索: ${safeTitle} - LibreTV`, 
                `/s=${encodedQuery}`
            );
            // 更新页面标题
            document.title = `搜索: ${safeTitle} - LibreTV`;
        } catch (e) {
            console.error('更新浏览器历史失败:', e);
        }
    }
}

// 填充搜索框，确保豆瓣资源API被选中，然后执行搜索
async function fillAndSearchWithDouban(title) {
    if (!title) return;
    
    // 安全处理标题，防止XSS
    const safeTitle = title
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
    
    // 确保豆瓣资源API被选中
    if (typeof selectedAPIs !== 'undefined' && !selectedAPIs.includes('dbzy')) {
        // 在设置中勾选豆瓣资源API复选框
        const doubanCheckbox = document.querySelector('input[id="api_dbzy"]');
        if (doubanCheckbox) {
            doubanCheckbox.checked = true;
            
            // 触发updateSelectedAPIs函数以更新状态
            if (typeof updateSelectedAPIs === 'function') {
                updateSelectedAPIs();
            } else {
                // 如果函数不可用，则手动添加到selectedAPIs
                selectedAPIs.push('dbzy');
                localStorage.setItem('selectedAPIs', JSON.stringify(selectedAPIs));
                
                // 更新选中API计数（如果有这个元素）
                const countEl = document.getElementById('selectedAPICount');
                if (countEl) {
                    countEl.textContent = selectedAPIs.length;
                }
            }
            
            showToast('已自动选择豆瓣资源API', 'info');
        }
    }
    
    // 填充搜索框并执行搜索
    const input = document.getElementById('searchInput');
    if (input) {
        input.value = safeTitle;
        await search(); // 使用已有的search函数执行搜索
        
        // 更新浏览器URL，使其反映当前的搜索状态
        try {
            // 使用URI编码确保特殊字符能够正确显示
            const encodedQuery = encodeURIComponent(safeTitle);
            // 使用HTML5 History API更新URL，不刷新页面
            window.history.pushState(
                { search: safeTitle }, 
                `搜索: ${safeTitle} - LibreTV`, 
                `/s=${encodedQuery}`
            );
            // 更新页面标题
            document.title = `搜索: ${safeTitle} - LibreTV`;
        } catch (e) {
            console.error('更新浏览器历史失败:', e);
        }

        if (window.innerWidth <= 768) {
          window.scrollTo({
              top: 0,
              behavior: 'smooth'
          });
        }
    }
}

// 渲染电影/电视剧切换器
function renderDoubanMovieTvSwitch() {
    // 获取切换按钮元素
    const movieToggle = document.getElementById('douban-movie-toggle');
    const tvToggle = document.getElementById('douban-tv-toggle');

    if (!movieToggle ||!tvToggle) return;

    movieToggle.addEventListener('click', function() {
        if (doubanMovieTvCurrentSwitch !== 'movie') {
            // 更新按钮样式
            movieToggle.classList.add('bg-pink-600', 'text-white');
            movieToggle.classList.remove('text-gray-300');
            
            tvToggle.classList.remove('bg-pink-600', 'text-white');
            tvToggle.classList.add('text-gray-300');
            
            doubanMovieTvCurrentSwitch = 'movie';
            doubanCurrentTag = '热门';

            // 重新加载豆瓣内容
            renderDoubanTags(movieTags);

            // 换一批按钮事件监听
            setupDoubanRefreshBtn();
            
            // 初始加载热门内容
            if (localStorage.getItem('doubanEnabled') === 'true') {
                renderRecommend(doubanCurrentTag, doubanPageSize, doubanPageStart);
            }
        }
    });
    
    // 电视剧按钮点击事件
    tvToggle.addEventListener('click', function() {
        if (doubanMovieTvCurrentSwitch !== 'tv') {
            // 更新按钮样式
            tvToggle.classList.add('bg-pink-600', 'text-white');
            tvToggle.classList.remove('text-gray-300');
            
            movieToggle.classList.remove('bg-pink-600', 'text-white');
            movieToggle.classList.add('text-gray-300');
            
            doubanMovieTvCurrentSwitch = 'tv';
            doubanCurrentTag = '热门';

            // 重新加载豆瓣内容
            renderDoubanTags(tvTags);

            // 换一批按钮事件监听
            setupDoubanRefreshBtn();
            
            // 初始加载热门内容
            if (localStorage.getItem('doubanEnabled') === 'true') {
                renderRecommend(doubanCurrentTag, doubanPageSize, doubanPageStart);
            }
        }
    });
}

// 渲染豆瓣标签选择器
function renderDoubanTags(tags) {
    const tagContainer = document.getElementById('douban-tags');
    if (!tagContainer) return;
    
    // 确定当前应该使用的标签列表
    const currentTags = doubanMovieTvCurrentSwitch === 'movie' ? movieTags : tvTags;
    
    // 清空标签容器
    tagContainer.innerHTML = '';

    // 先添加标签管理按钮
    const manageBtn = document.createElement('button');
    manageBtn.className = 'py-1.5 px-3.5 rounded text-sm font-medium transition-all duration-300 bg-[#1a1a1a] text-gray-300 hover:bg-pink-700 hover:text-white border border-[#333] hover:border-white';
    manageBtn.innerHTML = '<span class="flex items-center"><svg class="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"></path></svg>管理标签</span>';
    manageBtn.onclick = function() {
        showTagManageModal();
    };
    tagContainer.appendChild(manageBtn);

    // 添加所有标签
    currentTags.forEach(tag => {
        const btn = document.createElement('button');
        
        // 设置样式
        let btnClass = 'py-1.5 px-3.5 rounded text-sm font-medium transition-all duration-300 border ';
        
        // 当前选中的标签使用高亮样式
        if (tag === doubanCurrentTag) {
            btnClass += 'bg-pink-600 text-white shadow-md border-white';
        } else {
            btnClass += 'bg-[#1a1a1a] text-gray-300 hover:bg-pink-700 hover:text-white border-[#333] hover:border-white';
        }
        
        btn.className = `${btnClass} cinema-tag`;
        btn.textContent = tag;
        
        btn.onclick = function() {
            if (doubanCurrentTag !== tag) {
                doubanCurrentTag = tag;
                doubanPageStart = 0;
                renderRecommend(doubanCurrentTag, doubanPageSize, doubanPageStart);
                renderDoubanTags();
            }
        };
        
        tagContainer.appendChild(btn);
    });
}

// 设置换一批按钮事件
function setupDoubanRefreshBtn() {
    // 修复ID，使用正确的ID douban-refresh 而不是 douban-refresh-btn
    const btn = document.getElementById('douban-refresh');
    if (!btn) return;
    
    btn.onclick = function() {
        doubanPageStart += doubanPageSize;
        if (doubanPageStart > 9 * doubanPageSize) {
            doubanPageStart = 0;
        }
        
        renderRecommend(doubanCurrentTag, doubanPageSize, doubanPageStart);
    };
}

function fetchDoubanTags() {
    const movieTagsTarget = `https://movie.douban.com/j/search_tags?type=movie`
    fetchDoubanData(movieTagsTarget)
        .then(data => {
            movieTags = data.tags;
            if (doubanMovieTvCurrentSwitch === 'movie') {
                renderDoubanTags(movieTags);
            }
        })
        .catch(error => {
            console.error("获取豆瓣热门电影标签失败：", error);
        });
    const tvTagsTarget = `https://movie.douban.com/j/search_tags?type=tv`
    fetchDoubanData(tvTagsTarget)
       .then(data => {
            tvTags = data.tags;
            if (doubanMovieTvCurrentSwitch === 'tv') {
                renderDoubanTags(tvTags);
            }
        })
       .catch(error => {
            console.error("获取豆瓣热门电视剧标签失败：", error);
        });
}

// 渲染热门推荐内容
function renderRecommend(tag, pageLimit, pageStart) {
    const container = document.getElementById("douban-results");
    if (!container) return;

    // 中止上一个未完成的网络请求（避免竞态覆盖）
    if (currentDoubanAbortController) {
        try {
            currentDoubanAbortController.abort();
        } catch (e) {
            // ignore
        }
    }

    const abortController = new AbortController();
    currentDoubanAbortController = abortController;
    const thisRequestId = ++currentDoubanRequestId;
    isDoubanLoading = true;

    // 清理可能遗留的旧 loading 元素，避免重复叠放
    const oldLoading = container.querySelector('.douban-loading-overlay');
    if (oldLoading) {
        oldLoading.remove();
    }

    const loadingOverlayHTML = `
        <div class="douban-loading-overlay absolute inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-10">
            <div class="flex items-center justify-center">
                <div class="w-6 h-6 border-2 border-pink-500 border-t-transparent rounded-full animate-spin inline-block"></div>
                <span class="text-pink-500 ml-4">加载中...</span>
            </div>
        </div>
    `;

    container.classList.add("relative");
    container.insertAdjacentHTML('beforeend', loadingOverlayHTML);
    
    const target = `https://movie.douban.com/j/search_subjects?type=${doubanMovieTvCurrentSwitch}&tag=${tag}&sort=recommend&page_limit=${pageLimit}&page_start=${pageStart}`;
    
    // 使用通用请求函数
    fetchDoubanData(target, abortController.signal)
        .then(async data => {
            // 如果不是最新的请求，丢弃结果，防止二次刷新覆盖
            if (thisRequestId !== currentDoubanRequestId) {
                return;
            }
            await renderDoubanCards(data, container);
        })
        .catch(error => {
            // 主动取消或已不是最新请求，无需处理
            if (error.name === 'AbortError' || thisRequestId !== currentDoubanRequestId) {
                return;
            }
            console.error("获取豆瓣数据失败：", error);
            container.innerHTML = `
                <div class="col-span-full text-center py-8">
                    <div class="text-red-400">❌ 获取豆瓣数据失败，请稍后重试</div>
                    <div class="text-gray-500 text-sm mt-2">提示：使用VPN可能有助于解决此问题</div>
                </div>
            `;
        })
        .finally(() => {
            if (thisRequestId === currentDoubanRequestId) {
                isDoubanLoading = false;
                const loadingOverlay = container.querySelector('.douban-loading-overlay');
                if (loadingOverlay) {
                    loadingOverlay.remove();
                }
            }
        });
}

async function fetchDoubanData(url, externalSignal) {
    // 添加超时控制
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10秒超时
    
    if (externalSignal) {
        if (externalSignal.aborted) {
            controller.abort();
        } else {
            externalSignal.addEventListener('abort', () => controller.abort(), { once: true });
        }
    }

    // 设置请求选项，包括信号和头部
    const fetchOptions = {
        signal: controller.signal,
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
            'Referer': 'https://movie.douban.com/',
            'Accept': 'application/json, text/plain, */*',
        }
    };

    try {
        // 添加鉴权参数到代理URL
        const proxiedUrl = await window.ProxyAuth?.addAuthToProxyUrl ? 
            await window.ProxyAuth.addAuthToProxyUrl(PROXY_URL + encodeURIComponent(url)) :
            PROXY_URL + encodeURIComponent(url);
            
        // 尝试直接访问（豆瓣API可能允许部分CORS请求）
        const response = await fetch(proxiedUrl, fetchOptions);
        clearTimeout(timeoutId);
        
        if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`);
        }
        
        return await response.json();
    } catch (err) {
        if (err.name === 'AbortError' || (externalSignal && externalSignal.aborted)) {
            throw err;
        }
        console.error("豆瓣 API 请求失败（直接代理）：", err);
        
        // 失败后尝试备用方法：作为备选
        const fallbackUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(url)}`;
        
        try {
            const fallbackResponse = await fetch(fallbackUrl, {
                signal: controller.signal
            });
            clearTimeout(timeoutId);
            
            if (!fallbackResponse.ok) {
                throw new Error(`备用API请求失败! 状态: ${fallbackResponse.status}`);
            }
            
            const data = await fallbackResponse.json();
            
            // 解析原始内容
            if (data && data.contents) {
                return JSON.parse(data.contents);
            } else {
                throw new Error("无法获取有效数据");
            }
        } catch (fallbackErr) {
            console.error("豆瓣 API 备用请求也失败：", fallbackErr);
            throw fallbackErr; // 向上抛出错误，让调用者处理
        }
    }
}

async function buildDoubanCoverUrl(originalCoverUrl) {
    if (!originalCoverUrl) {
        return '';
    }

    const proxiedUrl = PROXY_URL + encodeURIComponent(originalCoverUrl);
    return window.ProxyAuth?.addAuthToProxyUrl
        ? await window.ProxyAuth.addAuthToProxyUrl(proxiedUrl)
        : proxiedUrl;
}

// 抽取渲染豆瓣卡片的逻辑到单独函数
async function renderDoubanCards(data, container) {
    // 创建文档片段以提高性能
    const fragment = document.createDocumentFragment();
    
    // 如果没有数据
    if (!data.subjects || data.subjects.length === 0) {
        const emptyEl = document.createElement("div");
        emptyEl.className = "col-span-full text-center py-8";
        emptyEl.innerHTML = `
            <div class="text-pink-500">❌ 暂无数据，请尝试其他分类或刷新</div>
        `;
        fragment.appendChild(emptyEl);
    } else {
        // 循环创建每个影视卡片
        const cards = await Promise.all(data.subjects.map(async (item, index) => {
            const card = document.createElement("div");
            card.className = "film-picker-card";
            card.setAttribute('role', 'group');
            
            // 生成卡片内容，确保安全显示（防止XSS）
            const safeTitle = item.title
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;');
            
            const safeRate = (item.rate || "暂无")
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;');
            
            const originalCoverUrl = item.cover || '';
            const proxiedCoverUrl = await buildDoubanCoverUrl(originalCoverUrl);
            
            // 为不同设备优化卡片布局：使用代理获取带豆瓣Referer的图片，失败时优雅降级为本地占位图，不触发重复请求
            card.innerHTML = `
                <div class="film-poster" onclick="activateDoubanCard(${index}, '${safeTitle}')" role="button" tabindex="0" aria-label="切换或搜索：${safeTitle}">
                    <img src="${proxiedCoverUrl || originalCoverUrl || 'image/nomedia.png'}" alt="${safeTitle}" 
                        class="w-full h-full object-cover transition-transform duration-500 hover:scale-110"
                        onerror="this.onerror=null; this.src='image/nomedia.png'; this.classList.add('object-contain');"
                        loading="lazy">
                    <div class="absolute inset-0 bg-gradient-to-t from-black to-transparent opacity-60"></div>
                    <div class="absolute bottom-2 left-2 bg-black/70 text-white text-xs px-2 py-1 rounded-sm">
                        <span class="text-yellow-400">★</span> ${safeRate}
                    </div>
                    <div class="absolute bottom-2 right-2 bg-black/70 text-white text-xs px-2 py-1 rounded-sm hover:bg-[#333] transition-colors">
                        <a href="${item.url}" target="_blank" rel="noopener noreferrer" title="在豆瓣查看" onclick="event.stopPropagation();">
                            🔗
                        </a>
                    </div>
                </div>
                <div class="film-card-title">
                    <button onclick="fillAndSearchWithDouban('${safeTitle}')"
                            title="${safeTitle}">
                        ${safeTitle}
                    </button>
                </div>
            `;
            
            return card;
        }));

        cards.forEach(card => fragment.appendChild(card));
    }
    
    // 清空并添加所有新元素
    container.innerHTML = "";
    container.appendChild(fragment);
    renderFilmSpaceWords(data.subjects || []);
    doubanOrbitPhase = 0;
    updateDoubanCarousel();
    startDoubanOrbit();
}

// 重置到首页
function resetToHome() {
    resetSearchArea();
    updateDoubanVisibility();
}

// 加载豆瓣首页内容
document.addEventListener('DOMContentLoaded', initDouban);

// 显示标签管理模态框
function showTagManageModal() {
    // 确保模态框在页面上只有一个实例
    let modal = document.getElementById('tagManageModal');
    if (modal) {
        document.body.removeChild(modal);
    }
    
    // 创建模态框元素
    modal = document.createElement('div');
    modal.id = 'tagManageModal';
    modal.className = 'fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-40';
    
    // 当前使用的标签类型和默认标签
    const isMovie = doubanMovieTvCurrentSwitch === 'movie';
    const currentTags = isMovie ? movieTags : tvTags;
    const defaultTags = isMovie ? defaultMovieTags : defaultTvTags;
    
    // 模态框内容
    modal.innerHTML = `
        <div class="bg-[#191919] rounded-lg p-6 max-w-md w-full max-h-[90vh] overflow-y-auto relative">
            <button id="closeTagModal" class="absolute top-4 right-4 text-gray-400 hover:text-white text-xl">&times;</button>
            
            <h3 class="text-xl font-bold text-white mb-4">标签管理 (${isMovie ? '电影' : '电视剧'})</h3>
            
            <div class="mb-4">
                <div class="flex justify-between items-center mb-2">
                    <h4 class="text-lg font-medium text-gray-300">标签列表</h4>
                    <button id="resetTagsBtn" class="text-xs px-2 py-1 bg-gray-700 hover:bg-gray-600 text-white rounded">
                        恢复默认标签
                    </button>
                </div>
                <div class="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-4" id="tagsGrid">
                    ${currentTags.length ? currentTags.map(tag => {
                        // "热门"标签不能删除
                        const canDelete = tag !== '热门';
                        return `
                            <div class="bg-[#1a1a1a] text-gray-300 py-1.5 px-3 rounded text-sm font-medium flex justify-between items-center group">
                                <span>${tag}</span>
                                ${canDelete ? 
                                    `<button class="delete-tag-btn text-gray-500 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity" 
                                        data-tag="${tag}">✕</button>` : 
                                    `<span class="text-gray-500 text-xs italic opacity-0 group-hover:opacity-100">必需</span>`
                                }
                            </div>
                        `;
                    }).join('') : 
                    `<div class="col-span-full text-center py-4 text-gray-500">无标签，请添加或恢复默认</div>`}
                </div>
            </div>
            
            <div class="border-t border-gray-700 pt-4">
                <h4 class="text-lg font-medium text-gray-300 mb-3">添加新标签</h4>
                <form id="addTagForm" class="flex items-center">
                    <input type="text" id="newTagInput" placeholder="输入标签名称..." 
                           class="flex-1 bg-[#222] text-white border border-gray-700 rounded px-3 py-2 focus:outline-none focus:border-pink-500">
                    <button type="submit" class="ml-2 bg-pink-600 hover:bg-pink-700 text-white px-4 py-2 rounded">添加</button>
                </form>
                <p class="text-xs text-gray-500 mt-2">提示：标签名称不能为空，不能重复，不能包含特殊字符</p>
            </div>
        </div>
    `;
    
    // 添加模态框到页面
    document.body.appendChild(modal);
    
    // 焦点放在输入框上
    setTimeout(() => {
        document.getElementById('newTagInput').focus();
    }, 100);
    
    // 添加事件监听器 - 关闭按钮
    document.getElementById('closeTagModal').addEventListener('click', function() {
        document.body.removeChild(modal);
    });
    
    // 添加事件监听器 - 点击模态框外部关闭
    modal.addEventListener('click', function(e) {
        if (e.target === modal) {
            document.body.removeChild(modal);
        }
    });
    
    // 添加事件监听器 - 恢复默认标签按钮
    document.getElementById('resetTagsBtn').addEventListener('click', function() {
        resetTagsToDefault();
        showTagManageModal(); // 重新加载模态框
    });
    
    // 添加事件监听器 - 删除标签按钮
    const deleteButtons = document.querySelectorAll('.delete-tag-btn');
    deleteButtons.forEach(btn => {
        btn.addEventListener('click', function() {
            const tagToDelete = this.getAttribute('data-tag');
            deleteTag(tagToDelete);
            showTagManageModal(); // 重新加载模态框
        });
    });
    
    // 添加事件监听器 - 表单提交
    document.getElementById('addTagForm').addEventListener('submit', function(e) {
        e.preventDefault();
        const input = document.getElementById('newTagInput');
        const newTag = input.value.trim();
        
        if (newTag) {
            addTag(newTag);
            input.value = '';
            showTagManageModal(); // 重新加载模态框
        }
    });
}

// 添加标签
function addTag(tag) {
    // 安全处理标签名，防止XSS
    const safeTag = tag
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
    
    // 确定当前使用的是电影还是电视剧标签
    const isMovie = doubanMovieTvCurrentSwitch === 'movie';
    const currentTags = isMovie ? movieTags : tvTags;
    
    // 检查是否已存在（忽略大小写）
    const exists = currentTags.some(
        existingTag => existingTag.toLowerCase() === safeTag.toLowerCase()
    );
    
    if (exists) {
        showToast('标签已存在', 'warning');
        return;
    }
    
    // 添加到对应的标签数组
    if (isMovie) {
        movieTags.push(safeTag);
    } else {
        tvTags.push(safeTag);
    }
    
    // 保存到本地存储
    saveUserTags();
    
    // 重新渲染标签
    renderDoubanTags();
    
    showToast('标签添加成功', 'success');
}

// 删除标签
function deleteTag(tag) {
    // 热门标签不能删除
    if (tag === '热门') {
        showToast('热门标签不能删除', 'warning');
        return;
    }
    
    // 确定当前使用的是电影还是电视剧标签
    const isMovie = doubanMovieTvCurrentSwitch === 'movie';
    const currentTags = isMovie ? movieTags : tvTags;
    
    // 寻找标签索引
    const index = currentTags.indexOf(tag);
    
    // 如果找到标签，则删除
    if (index !== -1) {
        currentTags.splice(index, 1);
        
        // 保存到本地存储
        saveUserTags();
        
        // 如果当前选中的是被删除的标签，则重置为"热门"
        if (doubanCurrentTag === tag) {
            doubanCurrentTag = '热门';
            doubanPageStart = 0;
            renderRecommend(doubanCurrentTag, doubanPageSize, doubanPageStart);
        }
        
        // 重新渲染标签
        renderDoubanTags();
        
        showToast('标签删除成功', 'success');
    }
}

// 重置为默认标签
function resetTagsToDefault() {
    // 确定当前使用的是电影还是电视剧
    const isMovie = doubanMovieTvCurrentSwitch === 'movie';
    
    // 重置为默认标签
    if (isMovie) {
        movieTags = [...defaultMovieTags];
    } else {
        tvTags = [...defaultTvTags];
    }
    
    // 设置当前标签为热门
    doubanCurrentTag = '热门';
    doubanPageStart = 0;
    
    // 保存到本地存储
    saveUserTags();
    
    // 重新渲染标签和内容
    renderDoubanTags();
    renderRecommend(doubanCurrentTag, doubanPageSize, doubanPageStart);
    
    showToast('已恢复默认标签', 'success');
}
