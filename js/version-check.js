// 添加动画样式
(function() {
    const style = document.createElement('style');
    style.textContent = `
        @keyframes pulse {
            0%, 100% {
                opacity: 1;
            }
            50% {
                opacity: 0.6;
            }
        }
        .animate-pulse {
            animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
        }
    `;
    document.head.appendChild(style);
})();

// 获取版本信息
async function fetchVersion(url, errorMessage, options = {}) {
    const response = await fetch(url, options);
    if (!response.ok) {
        throw new Error(errorMessage);
    }
    return await response.text();
}

// 版本检查函数
async function checkForUpdates() {
    try {
        // 获取当前版本
        let currentVersion = '202603300118';
        try {
            const fetchedCurrent = await fetchVersion('/VERSION.txt', '获取当前版本失败', {
                cache: 'no-store'
            });
            if (fetchedCurrent && fetchedCurrent.trim()) {
                currentVersion = fetchedCurrent.trim();
            }
        } catch (e) {
            console.warn('获取本地版本失败，使用内置版本:', e);
        }
        
        // 获取最新版本（多通道兜底：jsDelivr 全球加速 -> 镜像代理 -> GitHub 直连）
        let latestVersion = null;
        const VERSION_URLS = [
            'https://cdn.jsdelivr.net/gh/651355339/newlibertv@main/VERSION.txt',
            'https://ghfast.top/raw.githubusercontent.com/651355339/newlibertv/main/VERSION.txt',
            'https://raw.githubusercontent.com/651355339/newlibertv/main/VERSION.txt'
        ];
        
        for (const url of VERSION_URLS) {
            try {
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 3000);
                const res = await fetch(url, { signal: controller.signal });
                clearTimeout(timeoutId);
                if (res.ok) {
                    const text = await res.text();
                    if (text && text.trim().length > 0) {
                        latestVersion = text.trim();
                        break;
                    }
                }
            } catch (err) {
                // 自动尝试下一个版本检查源
            }
        }
        
        // 清理版本字符串
        const cleanCurrentVersion = currentVersion.trim();
        // 如果远端源均不可达，则优雅降级为显示当前版本，不报错阻断
        const cleanLatestVersion = latestVersion ? latestVersion.trim() : cleanCurrentVersion;
        
        console.log('当前版本:', cleanCurrentVersion);
        console.log('最新版本:', cleanLatestVersion);

        // 返回版本信息
        return {
            current: cleanCurrentVersion,
            latest: cleanLatestVersion,
            hasUpdate: parseInt(cleanLatestVersion) > parseInt(cleanCurrentVersion),
            currentFormatted: formatVersion(cleanCurrentVersion),
            latestFormatted: formatVersion(cleanLatestVersion)
        };
    } catch (error) {
        console.error('版本检测出错:', error);
        throw error;
    }
}

// 格式化版本号为可读形式 (yyyyMMddhhmm -> yyyy-MM-dd hh:mm)
function formatVersion(versionString) {
    // 检测版本字符串是否有效
    if (!versionString) {
        return '未知版本';
    }
    
    // 清理版本字符串（移除可能的空格或换行符）
    const cleanedString = versionString.trim();
    
    // 格式化标准12位版本号
    if (cleanedString.length === 12) {
        const year = cleanedString.substring(0, 4);
        const month = cleanedString.substring(4, 6);
        const day = cleanedString.substring(6, 8);
        const hour = cleanedString.substring(8, 10);
        const minute = cleanedString.substring(10, 12);
        
        return `${year}-${month}-${day} ${hour}:${minute}`;
    }
    
    return cleanedString;
}

// 创建错误版本信息元素
function createErrorVersionElement(errorMessage) {
    const errorElement = document.createElement('p');
    errorElement.className = 'text-gray-500 text-sm mt-1 text-center md:text-left';
    errorElement.innerHTML = `版本: <span class="text-amber-500">检测失败</span>`;
    errorElement.title = errorMessage;
    return errorElement;
}

// 添加版本信息到页脚
function addVersionInfoToFooter() {
    checkForUpdates().then(result => {
        if (!result) {
            // 如果版本检测失败，显示错误信息
            const versionElement = createErrorVersionElement();
            // 在页脚显示错误元素
            displayVersionElement(versionElement);
            return;
        }
        
        // 创建版本信息元素
        const versionElement = document.createElement('p');
        versionElement.className = 'text-gray-500 text-sm mt-1 text-center md:text-left';
        
        // 添加当前版本信息
        versionElement.innerHTML = `版本: ${result.currentFormatted}`;
        
        // 如果有更新，添加更新提示
        if (result.hasUpdate) {
            versionElement.innerHTML += ` <span class="inline-flex items-center bg-red-600 text-white text-xs px-2 py-0.5 rounded-md ml-1 cursor-pointer animate-pulse font-medium">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                发现新版
            </span>`;
            
            setTimeout(() => {
                const updateBtn = versionElement.querySelector('span');
                if (updateBtn) {
                    updateBtn.addEventListener('click', () => {
                        window.open('https://github.com/651355339/newlibertv', '_blank');
                    });
                }
            }, 100);
        } else {
            // 如果没有更新，显示当前版本为最新版本
            versionElement.innerHTML = `版本: ${result.currentFormatted} <span class="text-green-500">(最新版本)</span>`;
        }
        
        // 显示版本元素
        displayVersionElement(versionElement);
    }).catch(error => {
        console.error('版本检测出错:', error);
        // 创建错误版本信息元素并显示
        const errorElement = createErrorVersionElement(`错误信息: ${error.message}`);
        displayVersionElement(errorElement);
    });
}

// 在页脚显示版本元素的辅助函数
function displayVersionElement(element) {
    // 获取页脚元素
    const footerElement = document.querySelector('.footer p.text-gray-500.text-sm');
    if (footerElement) {
        // 在原版权信息后插入版本信息
        footerElement.insertAdjacentElement('afterend', element);
    } else {
        // 如果找不到页脚元素，尝试在页脚区域最后添加
        const footer = document.querySelector('.footer .container');
        if (footer) {
            footer.querySelector('div').appendChild(element);
        }
    }
}

// 页面加载完成后添加版本信息
document.addEventListener('DOMContentLoaded', addVersionInfoToFooter);
