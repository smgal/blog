class IRiSArchive {
  constructor() {
    this.posts = [];
    this.filteredPosts = [];
    this.postGroups = []; // 원글 기준 그룹
    this.currentPage = 1;
    this.postsPerPage = 5; // 원글 기준으로 페이지당 5개
    this.currentFilter = 'all';
    this.currentSearch = '';
    this.lastSearch = '';
    this.allPostGroups = [];
    
    this.init();
  }
  
  async init() {
    try {
      await this.loadPosts();
      this.setupEvents();
      this.applyFilters();
      console.log('📚 IRiS nX Archive 로드 완료');
    } catch (error) {
      console.error('초기화 실패:', error);
      this.showError('데이터를 불러오는데 실패했습니다.');
    }
  }
  
  async loadPosts() {
    const response = await fetch('data/posts.json');
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const data = await response.json();
    this.posts = data.posts || [];
    this.filteredPosts = [...this.posts];
    this.metadata = data.metadata || {};
    
    console.log(`✅ ${this.posts.length}개 게시물 로드 완료`);
  }
  
  setupEvents() {
    const searchInput = document.getElementById('search');
    
    searchInput.addEventListener('input', (e) => {
      this.currentSearch = e.target.value.trim();
      this.applyFilters();
    });
    
    document.querySelectorAll('.filter-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
        e.target.classList.add('active');
        
        this.currentFilter = e.target.dataset.filter;
        this.applyFilters();
      });
    });
  }
  
  /**
   * 원글 기준으로 그룹화
   */
  groupPostsByOriginal(posts) {
    const groups = new Map();
    
    // ID별로 그룹화
    posts.forEach(post => {
      if (!groups.has(post.id)) {
        groups.set(post.id, []);
      }
      groups.get(post.id).push(post);
    });
    
    // 각 그룹 내에서 sn으로 정렬하고 배열로 변환
    const result = [];
    for (const [id, group] of groups) {
      group.sort((a, b) => a.sn - b.sn);
      result.push(group);
    }
    
    // ID 역순으로 정렬 (최신 게시물이 위로)
    result.sort((a, b) => b[0].id - a[0].id);
    
    return result;
  }
  
  applyFilters() {
    let filtered = [...this.posts];
    
    // 검색 필터
    if (this.currentSearch) {
      const searchLower = this.currentSearch.toLowerCase();
      filtered = filtered.filter(post => 
        post.title.toLowerCase().includes(searchLower) ||
        post.content.toLowerCase().includes(searchLower) ||
        post.name.toLowerCase().includes(searchLower)
      );
    }
    
    this.filteredPosts = filtered;
    // 원글 기준으로 그룹화 (답글 포함)
    this.allPostGroups = this.groupPostsByOriginal(filtered);
    
    // 검색 필터가 바뀐 경우에만 페이지 리셋
    if (this.lastSearch !== this.currentSearch) {
      this.currentPage = 1;
    }
    this.lastSearch = this.currentSearch;
    
    this.renderPosts();
    this.renderPagination();
  }
  
  renderPosts() {
    const container = document.getElementById('posts-container');
    const startIdx = (this.currentPage - 1) * this.postsPerPage;
    const endIdx = startIdx + this.postsPerPage;
    const groupsToShow = this.allPostGroups.slice(startIdx, endIdx);
    
    if (groupsToShow.length === 0) {
      container.innerHTML = `
        <div class="no-results" style="text-align: center; padding: 3rem; color: #6c757d;">
          <h3>😕 검색 결과가 없습니다</h3>
          <p>다른 검색어를 시도해보세요.</p>
        </div>
      `;
    } else {
      const html = groupsToShow.map(group => {
        // 글 유형 필터 적용
        let filteredGroup = group;
        if (this.currentFilter === 'original') {
          filteredGroup = group.filter(post => post.sn === 0);
        }
        
        return filteredGroup.map(post => this.createPostHTML(post)).join('');
      }).join('<div class="post-group-separator"></div>');
      
      container.innerHTML = html;
    }
    
    this.renderPagination();
  }
  
  createPostHTML(post) {
    const isReply = post.sn > 0;
    const replyClass = isReply ? 'reply-indent' : '';
    // 이미지 스타일 처리
    let processedContent = post.content;
    if (post.attachment && post.attachment.trim()) {
      const filename = post.attachment.trim();
      const styleClass = post.style === 1 ? 'style="float: left; margin: 0 1rem 1rem 0; max-width: 300px;"' : 
                        post.style === 2 ? 'style="float: right; margin: 0 0 1rem 1rem; max-width: 300px;"' : 
                        'style="display: block; margin: 1rem auto; max-width: 100%;"';
      if (!processedContent.includes(filename)) {
        processedContent += `<br><img src="images/${filename}" alt="${post.title}" ${styleClass}>`;
      }
    }
    // 본문 클래스 구분
    const contentClass = isReply ? 'reply-content' : 'post-content original-content';
    return `
      <article class="post ${replyClass}" data-id="${post.id}">
        <div class="${isReply ? 'reply-header' : 'post-header'}">
          ${!isReply ? `<h3 class="post-title">${post.title || '(제목 없음)'}</h3>` : ''}
          <div class="post-meta">
            <span class="author">👤 ${this.escapeHtml(post.name)}</span>
            <span class="date">📅 ${this.formatDate(post.timestamp)}</span>
            <span class="post-number">#${post.id}${isReply ? `-${post.sn}` : ''}</span>
            ${isReply ? '<span class="reply-badge">답글</span>' : ''}
          </div>
        </div>
        <div class="${contentClass}">
          ${processedContent}
        </div>
      </article>
    `;
  }
  
  renderPagination() {
    const topContainer = document.getElementById('pagination-top');
    const bottomContainer = document.getElementById('pagination');
    const totalPages = Math.ceil(this.allPostGroups.length / this.postsPerPage);
    
    if (totalPages <= 1) {
      topContainer.innerHTML = '';
      bottomContainer.innerHTML = '';
      return;
    }
    
    let paginationHTML = '<div class="pagination">';
    
    // 이전 페이지 버튼
    if (this.currentPage > 1) {
      paginationHTML += `<button class="page-btn" onclick="archive.goToPage(${this.currentPage - 1})">◀ 이전</button>`;
    }
    
    // 페이지 번호들
    const startPage = Math.max(1, this.currentPage - 2);
    const endPage = Math.min(totalPages, this.currentPage + 2);
    
    for (let i = startPage; i <= endPage; i++) {
      const activeClass = i === this.currentPage ? 'active' : '';
      paginationHTML += `<button class="page-btn ${activeClass}" onclick="archive.goToPage(${i})">${i}</button>`;
    }
    
    // 다음 페이지 버튼
    if (this.currentPage < totalPages) {
      paginationHTML += `<button class="page-btn" onclick="archive.goToPage(${this.currentPage + 1})">다음 ▶</button>`;
    }
    
    paginationHTML += '</div>';
    
    // 위쪽과 아래쪽 모두에 동일한 페이지네이션 적용
    topContainer.innerHTML = paginationHTML;
    bottomContainer.innerHTML = paginationHTML;
  }
  
  goToPage(page) {
    this.currentPage = page;
    this.renderPosts();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  formatDate(dateStr) {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) {
      return 'Invalid Date';
    }
    return date.toLocaleString('ko-KR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }
  
  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
  
  showError(message) {
    const container = document.getElementById('posts-container');
    container.innerHTML = `
      <div class="error-message" style="text-align: center; padding: 3rem; color: #dc3545;">
        <h3>❌ 오류 발생</h3>
        <p>${message}</p>
        <button onclick="location.reload()" style="margin-top: 1rem; padding: 0.5rem 1rem; background: #dc3545; color: white; border: none; border-radius: 4px; cursor: pointer;">페이지 새로고침</button>
      </div>
    `;
  }
}

let archive;

document.addEventListener('DOMContentLoaded', () => {
  archive = new IRiSArchive();
});