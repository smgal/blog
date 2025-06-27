class GuestbookApp {
    constructor() {
        this.posts = [];
        this.filteredPosts = [];
        this.currentPage = 1;
        this.postsPerPage = 10;
        this.currentFilter = 'all';
        this.currentYear = 'all';
        this.currentSearch = '';
        this.availableYears = []; // 사용 가능한 연도 목록
        
        this.init();
    }
    
    async init() {
        console.log('🚀 방명록 앱 초기화 중...');
        await this.loadData();
        this.initUrlParams();
        this.generateYearFilters(); // 연도 필터 동적 생성
        this.bindEvents();
        this.render();
    }
    
    async loadData() {
        try {
            // 데이터 파일 경로를 현재 위치 기준으로 설정
            const response = await fetch('./data/guestbook.json');
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const data = await response.json();
            this.posts = data.posts || [];
            this.filteredPosts = [...this.posts];
            
            // 사용 가능한 연도 추출
            this.extractAvailableYears();
            
            console.log(`✅ ${this.posts.length}개 게시물 로드 완료`);
            console.log(`📅 발견된 연도: ${this.availableYears.join(', ')}`);
            this.updateStats();
        } catch (error) {
            console.error('❌ 데이터 로드 실패:', error);
            this.handleDataLoadError();
        }
    }
    
    // 데이터에서 사용 가능한 연도들을 추출
    extractAvailableYears() {
        const yearSet = new Set();
        
        // 모든 게시물의 연도 추출
        this.posts.forEach(post => {
            const year = new Date(post.datetime).getFullYear();
            yearSet.add(year);
            
            // 댓글의 연도도 추출
            if (post.replies && post.replies.length > 0) {
                post.replies.forEach(reply => {
                    const replyYear = new Date(reply.datetime).getFullYear();
                    yearSet.add(replyYear);
                });
            }
        });
        
        // 연도를 내림차순으로 정렬 (최신 연도부터)
        this.availableYears = Array.from(yearSet).sort((a, b) => b - a);
    }
    
    // 연도 필터 버튼들을 동적으로 생성
    generateYearFilters() {
        const yearFilterGroup = document.querySelector('.year-row');
        if (!yearFilterGroup) {
            console.warn('연도 필터 컨테이너를 찾을 수 없습니다.');
            return;
        }
        
        // 기존 버튼들 제거 (전체 버튼은 유지)
        const existingButtons = yearFilterGroup.querySelectorAll('.year-btn');
        existingButtons.forEach(btn => {
            if (btn.dataset.year !== 'all') {
                btn.remove();
            }
        });
        
        // 발견된 연도들로 새 버튼 생성
        this.availableYears.forEach(year => {
            const button = document.createElement('button');
            button.className = 'year-btn';
            button.dataset.year = year.toString();
            button.textContent = `${year}년`;
            yearFilterGroup.appendChild(button);
        });
        
        console.log(`🎛️ ${this.availableYears.length}개 연도 필터 생성 완료`);
    }
    
    handleDataLoadError() {
        const container = document.getElementById('posts-container');
        container.innerHTML = `
            <div class="empty">
                <h3>데이터를 불러올 수 없습니다</h3>
                <p>guestbook.json 파일을 확인해주세요.</p>
            </div>
        `;
    }
    
    bindEvents() {
        // 검색
        const searchInput = document.getElementById('search');
        searchInput.addEventListener('input', (e) => {
            this.currentSearch = e.target.value;
            this.currentPage = 1;
            this.applyFiltersAndUpdateUrl();
        });
        
        // 연도 필터 (동적으로 생성된 버튼들에 이벤트 바인딩)
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('year-btn')) {
                document.querySelectorAll('.year-btn').forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');
                this.currentYear = e.target.dataset.year;
                this.currentPage = 1;
                this.applyFiltersAndUpdateUrl();
            }
        });
        
        // 타입 필터
        document.querySelectorAll('.filter-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');
                this.currentFilter = e.target.dataset.filter;
                this.currentPage = 1;
                this.applyFiltersAndUpdateUrl();
            });
        });
        
        // 브라우저 뒤로가기/앞으로가기 지원
        window.addEventListener('popstate', (e) => {
            this.initUrlParams();
            this.applyFilters();
        });
    }
    
    initUrlParams() {
        const urlParams = new URLSearchParams(window.location.search);
        const page = parseInt(urlParams.get('page')) || 1;
        this.currentPage = Math.max(1, page);
    }
    
    applyFilters() {
        let filtered = [...this.posts];
        
        // 연도 필터
        if (this.currentYear !== 'all') {
            filtered = filtered.filter(post => {
                const year = new Date(post.datetime).getFullYear().toString();
                return year === this.currentYear;
            });
        }
        
        // 타입 필터
        if (this.currentFilter === 'original') {
            filtered = filtered.filter(post => post.is_original);
        }
        
        // 검색 필터
        if (this.currentSearch.trim()) {
            const searchTerm = this.currentSearch.toLowerCase();
            filtered = filtered.filter(post => {
                const searchableText = [
                    post.title,
                    post.author,
                    post.content,
                    ...post.replies.flatMap(reply => [reply.title, reply.author, reply.content])
                ].join(' ').toLowerCase();
                
                return searchableText.includes(searchTerm);
            });
        }
        
        this.filteredPosts = filtered;
        this.render();
    }
    
    applyFiltersAndUpdateUrl() {
        this.applyFilters();
        this.updateUrl();
    }
    
    updateUrl() {
        const url = new URL(window.location);
        if (this.currentPage > 1) {
            url.searchParams.set('page', this.currentPage);
        } else {
            url.searchParams.delete('page');
        }
        window.history.pushState({}, '', url);
    }
    
    updateStats() {
        const total = this.posts.length + this.posts.reduce((sum, post) => sum + post.replies.length, 0);
        const originals = this.posts.length;
        const replies = this.posts.reduce((sum, post) => sum + post.replies.length, 0);
        
        document.getElementById('total-posts').textContent = `총 ${total}개 게시물`;
        document.getElementById('original-posts').textContent = `원글 ${originals}개`;
        document.getElementById('reply-posts').textContent = `댓글 ${replies}개`;
    }
    
    render() {
        this.renderPosts();
        this.renderPagination();
        this.validateCurrentPage();
    }
    
    validateCurrentPage() {
        const totalPages = Math.ceil(this.filteredPosts.length / this.postsPerPage);
        if (this.currentPage > totalPages && totalPages > 0) {
            this.currentPage = totalPages;
            this.updateUrl();
            this.render();
        }
    }
    
    renderPosts() {
        const container = document.getElementById('posts-container');
        
        if (this.filteredPosts.length === 0) {
            container.innerHTML = `
                <div class="empty">
                    <h3>게시물이 없습니다</h3>
                    <p>다른 검색어나 필터를 시도해보세요.</p>
                </div>
            `;
            return;
        }
        
        const startIndex = (this.currentPage - 1) * this.postsPerPage;
        const endIndex = startIndex + this.postsPerPage;
        const postsToShow = this.filteredPosts.slice(startIndex, endIndex);
        
        container.innerHTML = postsToShow.map(post => this.renderPost(post)).join('');
    }
    
    renderPost(post) {
        const postDate = new Date(post.datetime);
        const formattedDate = postDate.toLocaleDateString('ko-KR', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
        
        const highlightedTitle = this.highlightText(post.title);
        const highlightedContent = this.highlightText(post.content);
        const highlightedAuthor = this.highlightText(post.author);
        
        let repliesHtml = '';
        // '원글만' 필터가 선택되지 않은 경우에만 댓글 표시
        if (this.currentFilter !== 'original' && post.replies && post.replies.length > 0) {
            repliesHtml = post.replies.map(reply => this.renderReply(reply)).join('');
        }
        
        return `
            <div class="post">
                <div class="post-header">
                    <div class="post-id">#${post.id}</div>
                    <div class="post-title">${highlightedTitle}</div>
                    <div class="post-meta">
                        <span class="post-author">👤 ${highlightedAuthor}</span>
                        <span class="post-date">📅 ${formattedDate}</span>
                    </div>
                </div>
                <div class="post-content">${highlightedContent}</div>
                ${repliesHtml}
            </div>
        `;
    }
    
    renderReply(reply) {
        const replyDate = new Date(reply.datetime);
        const formattedDate = replyDate.toLocaleDateString('ko-KR', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
        
        const highlightedTitle = this.highlightText(reply.title || 'Re: ');
        const highlightedContent = this.highlightText(reply.content);
        const highlightedAuthor = this.highlightText(reply.author);
        
        return `
            <div class="reply">
                <div class="post-header">
                    <div class="post-id">Re: #${reply.id}</div>
                    <div class="post-title">${highlightedTitle}</div>
                    <div class="post-meta">
                        <span class="post-author">👤 ${highlightedAuthor}</span>
                        <span class="post-date">📅 ${formattedDate}</span>
                    </div>
                </div>
                <div class="post-content">${highlightedContent}</div>
            </div>
        `;
    }
    
    highlightText(text) {
        if (!this.currentSearch.trim() || !text) return text || '';
        
        const searchTerm = this.currentSearch.trim();
        const regex = new RegExp(`(${searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
        return text.replace(regex, '<span class="highlight">$1</span>');
    }
    
    renderPagination() {
        const totalPages = Math.ceil(this.filteredPosts.length / this.postsPerPage);
        const topPagination = document.getElementById('pagination-top');
        const bottomPagination = document.getElementById('pagination');
        
        if (totalPages <= 1) {
            topPagination.innerHTML = '';
            bottomPagination.innerHTML = '';
            return;
        }
        
        const paginationHtml = this.getPaginationHtml(totalPages);
        topPagination.innerHTML = paginationHtml;
        bottomPagination.innerHTML = paginationHtml;
        
        // 이벤트 바인딩
        [topPagination, bottomPagination].forEach(container => {
            container.querySelectorAll('button[data-page]').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const page = parseInt(e.target.dataset.page);
                    if (page !== this.currentPage) {
                        this.currentPage = page;
                        this.render();
                        this.updateUrl();
                        window.scrollTo({ top: 0, behavior: 'smooth' });
                    }
                });
            });
        });
    }
    
    getPaginationHtml(totalPages) {
        let html = '<div class="pagination">';
        
        // 이전 버튼
        html += `<button ${this.currentPage === 1 ? 'disabled' : ''} data-page="${this.currentPage - 1}">‹ 이전</button>`;
        
        // 페이지 버튼들
        const startPage = Math.max(1, this.currentPage - 2);
        const endPage = Math.min(totalPages, this.currentPage + 2);
        
        if (startPage > 1) {
            html += `<button data-page="1">1</button>`;
            if (startPage > 2) {
                html += `<span>...</span>`;
            }
        }
        
        for (let i = startPage; i <= endPage; i++) {
            html += `<button ${i === this.currentPage ? 'class="active"' : ''} data-page="${i}">${i}</button>`;
        }
        
        if (endPage < totalPages) {
            if (endPage < totalPages - 1) {
                html += `<span>...</span>`;
            }
            html += `<button data-page="${totalPages}">${totalPages}</button>`;
        }
        
        // 다음 버튼
        html += `<button ${this.currentPage === totalPages ? 'disabled' : ''} data-page="${this.currentPage + 1}">다음 ›</button>`;
        
        html += '</div>';
        return html;
    }
}

// 앱 시작
document.addEventListener('DOMContentLoaded', () => {
    new GuestbookApp();
}); 