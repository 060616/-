// DOM引用存储
const domRefs = new WeakMap();

// 初始化函数
export function initializeDisplay() {
    try {
        const container = createPreviewContainer();
        domRefs.set(window, {
            container,
            previewImage: container.querySelector('.card-preview-image'),
            closeButton: container.querySelector('.card-preview-close')
        });
        
        bindEvents();
        
    } catch (error) {
        console.error('[Display] 初始化失败:', error);
        // 触发错误事件
        window.dispatchEvent(new CustomEvent('card-preview-error', {
            detail: { error, type: 'INIT_ERROR' }
        }));
    }
}

// 创建预览容器
function createPreviewContainer() {
    const container = document.createElement('div');
    container.className = 'card-preview-container';
    container.innerHTML = `
        <div class="card-preview-content">
            <img class="card-preview-image" alt="预览图片">
            <button class="card-preview-close">关闭</button>
            <div class="card-preview-error"></div>
        </div>
    `;
    document.body.appendChild(container);
    return container;
}

// 显示预览
export async function showPreview(imageUrl) {
    try {
        const refs = domRefs.get(window);
        if (!refs) {
            throw new Error('DOM引用未初始化');
        }
        
        const { container, previewImage } = refs;
        
        // 显示加载状态
        container.classList.add('loading');
        
        // 加载图片
        await loadImage(imageUrl);
        
        // 更新图片并显示
        previewImage.src = imageUrl;
        container.classList.remove('loading');
        container.classList.add('visible');
        
    } catch (error) {
        handlePreviewError(error);
    }
}

// 图片加载函数
function loadImage(url) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve();
        img.onerror = () => reject(new Error('图片加载失败'));
        img.src = url;
    });
}

// 错误处理
function handlePreviewError(error) {
    console.error('[Display] 预览显示失败:', error);
    
    const refs = domRefs.get(window);
    if (refs) {
        const errorEl = refs.container.querySelector('.card-preview-error');
        errorEl.textContent = '预览加载失败,请重试';
        errorEl.style.display = 'block';
    }
    
    window.dispatchEvent(new CustomEvent('card-preview-error', {
        detail: { error, type: 'PREVIEW_ERROR' }
    }));
}

// 绑定事件
function bindEvents() {
    const refs = domRefs.get(window);
    if (!refs) return;
    
    refs.closeButton.addEventListener('click', () => {
        refs.container.classList.remove('visible');
    });
    
    // 添加错误恢复机制
    window.addEventListener('card-preview-retry', () => {
        const errorEl = refs.container.querySelector('.card-preview-error');
        errorEl.style.display = 'none';
    });
} 