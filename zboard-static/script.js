// 게시판 데이터와 설정
let postsData = [];
let commentsData = [];
let currentPage = 1;
let totalPages = 1;
const postsPerPage = 10;

// DOM 요소들
const postsContainer = document.getElementById('posts-container');
const paginationTop = document.getElementById('pagination-top');
const paginationBottom = document.getElementById('pagination-bottom');

// HTML 엔티티 디코딩 함수
function decodeHtmlEntities(text) {
    if (!text) return '';

    // 특수 문자 디코딩
    let decoded = text
        .replace(/&nbsp;/g, ' ')
        .replace(/&gt;/g, '>')
        .replace(/&lt;/g, '<')
        .replace(/&quot;/g, '"')
        .replace(/\\'/g, "'");

    // &amp; 디코딩은 마지막에 수행 (다른 엔티티에 영향 주지 않도록)
    decoded = decoded.replace(/&amp;/g, '&');

    // 숫자 엔티티 디코딩 (&#46124; 형태)
    decoded = decoded.replace(/&#([0-9]+);/g, function (match, dec) {
        return String.fromCharCode(parseInt(dec, 10));
    });

    return decoded;
}

// 데이터 로드 함수
async function loadData() {
    try {
        // URL 파라미터에서 board 이름 읽기
        const urlParams = new URLSearchParams(window.location.search);
        const boardName = urlParams.get('board') || 'smgal_net_bbs';

        // 게시글 데이터 로드
        const postsResponse = await fetch(`./data/zetyx_board_body_${boardName}.jsonl`);
        const postsText = await postsResponse.text();
        postsData = postsText.trim().split('\n').map(line => JSON.parse(line));

        // 댓글 데이터 로드
        const commentsResponse = await fetch(`./data/zetyx_board_comment_${boardName}.jsonl`);

        if (commentsResponse.ok) {
            const commentsText = await commentsResponse.text();
            commentsData = commentsText.trim().split('\n').map(line => JSON.parse(line));
        } else {
            commentsData = [];
        }

        // 데이터 정렬 (headnum 기준 내림차순 - 최신순)
        postsData.sort((a, b) => parseInt(b.headnum) - parseInt(a.headnum));

        // 페이지 계산
        totalPages = Math.ceil(postsData.length / postsPerPage);

        // URL 파라미터에서 페이지 번호 읽기
        currentPage = parseInt(urlParams.get('page')) || 1;

        if (currentPage > totalPages) currentPage = totalPages;
        if (currentPage < 1) currentPage = 1;

        renderPagination();
        renderPosts();

    } catch (error) {
        console.error('데이터 로드 중 오류:', error);
        postsContainer.innerHTML = '<p>데이터를 불러오는 중 오류가 발생했습니다.</p>';
    }
}

// 게시글 렌더링 함수
function renderPosts() {
    postsContainer.innerHTML = '<div class="loading">게시물을 불러오는 중...</div>';

    const startIndex = (currentPage - 1) * postsPerPage;
    const endIndex = startIndex + postsPerPage;
    const currentPosts = postsData.slice(startIndex, endIndex);

    if (currentPosts.length === 0) {
        postsContainer.innerHTML = '<p>표시할 게시물이 없습니다.</p>';
        return;
    }

    postsContainer.innerHTML = '';

    currentPosts.forEach(post => {
        const postElement = createPostElement(post);
        postsContainer.appendChild(postElement);

        // 댓글 로드 및 렌더링
        const postComments = commentsData.filter(comment => comment.parent === post.no);
        if (postComments.length > 0) {
            postComments.sort((a, b) => parseInt(a.reg_date) - parseInt(b.reg_date));
            postComments.forEach(comment => {
                const commentElement = createCommentElement(comment, post.no);
                postElement.appendChild(commentElement);
            });
        }
    });
}

// 게시글 요소 생성 함수
function createPostElement(post) {
    const postElement = document.createElement('div');
    postElement.classList.add('post');

    // Header Row
    const headerElement = document.createElement('div');
    headerElement.classList.add('post-header');

    const metaLeftElement = document.createElement('div');
    metaLeftElement.classList.add('post-meta-left');

    const postNumberElement = document.createElement('span');
    postNumberElement.classList.add('post-number');
    postNumberElement.textContent = `#${post.no}`;

    const authorElement = document.createElement('span');
    authorElement.classList.add('author');
    if (post.email) {
        const authorLink = document.createElement('a');
        authorLink.href = `mailto:${post.email}`;
        authorLink.textContent = decodeHtmlEntities(post.name);
        authorElement.appendChild(authorLink);
    } else {
        authorElement.textContent = decodeHtmlEntities(post.name);
    }

    metaLeftElement.appendChild(postNumberElement);
    metaLeftElement.appendChild(authorElement);

    if (post.homepage) {
        const homepageLink = document.createElement('a');
        let homepageUrl = post.homepage;
        if (!homepageUrl.startsWith('http://') && !homepageUrl.startsWith('https://')) {
            homepageUrl = 'http://' + homepageUrl;
        }
        homepageLink.href = homepageUrl;
        homepageLink.textContent = `[홈페이지]`;
        homepageLink.target = '_blank';
        homepageLink.classList.add('homepage-link');
        metaLeftElement.appendChild(homepageLink);
    }

    const metaRightElement = document.createElement('div');
    metaRightElement.classList.add('post-meta-right');

    // 댓글 수 표시
    if (post.total_comment && parseInt(post.total_comment) > 0) {
        const commentsCount = document.createElement('span');
        commentsCount.classList.add('comments-count');
        commentsCount.textContent = `댓글 ${post.total_comment}개`;
        metaRightElement.appendChild(commentsCount);
    }

    headerElement.appendChild(metaLeftElement);
    headerElement.appendChild(metaRightElement);

    // Title Bar Row
    const titleBarElement = document.createElement('div');
    titleBarElement.classList.add('post-title-bar');

    const titleElement = document.createElement('span');
    titleElement.textContent = decodeHtmlEntities(post.subject);

    const timestampElement = document.createElement('span');
    timestampElement.classList.add('post-timestamp');

    const date = new Date(parseInt(post.reg_date) * 1000);
    const days = ['일', '월', '화', '수', '목', '금', '토'];
    const dayName = days[date.getDay()];
    const dateString = `${date.getFullYear()}/${String(date.getMonth() + 1).padStart(2, '0')}/${String(date.getDate()).padStart(2, '0')} (${dayName})`;

    let hours = date.getHours();
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    hours = hours ? hours : 12;
    const timeString = `${ampm} ${String(hours).padStart(2, '0')}:${minutes}`;

    const dateSpan = document.createElement('span');
    dateSpan.classList.add('date');
    dateSpan.textContent = dateString;

    const timeSpan = document.createElement('span');
    timeSpan.classList.add('time');
    timeSpan.textContent = timeString;

    timestampElement.appendChild(dateSpan);
    timestampElement.appendChild(timeSpan);

    titleBarElement.appendChild(titleElement);
    titleBarElement.appendChild(timestampElement);

    // Content
    const contentElement = document.createElement('div');
    contentElement.classList.add('post-content');

    // 첨부파일 처리 함수
    const createAttachmentElement = (fileName, sFileName) => {
        const container = document.createElement('div');
        container.classList.add('attachment-file');
        container.style.marginBottom = '10px';

        const isImage = /\.(jpg|jpeg|png|gif|bmp|webp)$/i.test(fileName);

        // 파일 경로 수정: 데이터 파일이 ../data/ 에 있고, 이미지는 그 안의 경로를 따름
        // 하지만 file_name1이 'data/...' 로 시작하는지, 아니면 그냥 파일명인지 확인 필요
        // 문서상 '상대적 위치'라고 했으므로 그대로 사용하되, 
        // 현재 페이지(index.html) 기준 data/ 폴더가 ./data/ 임.
        // file_name이 'data/foo.jpg'라면 './data/foo.jpg'로 접근 가능.
        // 만약 file_name이 그냥 'foo.jpg'라면 './data/foo.jpg'로 가정해야 할 수도 있음.
        // 일단은 file_name 값을 그대로 href/src에 사용.

        // 안전한 경로 처리를 위해 필요한 경우 수정 가능.
        // 여기서는 file_name이 상대 경로라고 가정.

        if (isImage) {
            const img = document.createElement('img');
            img.src = fileName;
            img.style.maxWidth = '100%';
            img.alt = sFileName || fileName;
            container.appendChild(img);
        } else {
            const link = document.createElement('a');
            link.href = fileName;
            link.textContent = sFileName || fileName;
            link.download = sFileName || fileName; // 다운로드 속성 추가
            link.target = '_blank';
            container.appendChild(link);
        }
        return container;
    };

    // 1번 파일
    if (post.file_name1) {
        contentElement.appendChild(createAttachmentElement(post.file_name1, post.s_file_name1));
    }

    // 2번 파일
    if (post.file_name2) {
        contentElement.appendChild(createAttachmentElement(post.file_name2, post.s_file_name2));
    }

    // 본문 내용
    const textWrapper = document.createElement('div');

    // memo 필드 처리 (줄바꿈 변환 및 HTML 렌더링)
    let content = post.memo || '';
    content = content.replace(/\\r\\n/g, '\n');

    if (post.use_html === '1' || post.use_html === '2') {
        // HTML 모드인 경우 HTML로 렌더링
        content = decodeHtmlEntities(content);
        textWrapper.innerHTML = content;
    } else {
        // 텍스트 모드인 경우 텍스트로 표시
        content = decodeHtmlEntities(content);
        textWrapper.textContent = content;
    }
    contentElement.appendChild(textWrapper);

    postElement.appendChild(headerElement);
    postElement.appendChild(titleBarElement);
    postElement.appendChild(contentElement);

    return postElement;
}

// 댓글 요소 생성 함수
function createCommentElement(comment, parentPostNo) {
    const commentElement = document.createElement('div');
    commentElement.classList.add('post', 'comment');

    // Header Row
    const headerElement = document.createElement('div');
    headerElement.classList.add('post-header');

    const metaLeftElement = document.createElement('div');
    metaLeftElement.classList.add('post-meta-left');

    const postNumberElement = document.createElement('span');
    postNumberElement.classList.add('post-number');
    postNumberElement.textContent = `#${parentPostNo}-${comment.no}`;

    const authorElement = document.createElement('span');
    authorElement.classList.add('author');
    authorElement.textContent = decodeHtmlEntities(comment.name);

    metaLeftElement.appendChild(postNumberElement);
    metaLeftElement.appendChild(authorElement);

    const timestampElement = document.createElement('span');
    timestampElement.classList.add('post-timestamp');

    const date = new Date(parseInt(comment.reg_date) * 1000);
    const days = ['일', '월', '화', '수', '목', '금', '토'];
    const dayName = days[date.getDay()];
    const dateString = `${date.getFullYear()}/${String(date.getMonth() + 1).padStart(2, '0')}/${String(date.getDate()).padStart(2, '0')} (${dayName})`;

    let hours = date.getHours();
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    hours = hours ? hours : 12;
    const timeString = `${ampm} ${String(hours).padStart(2, '0')}:${minutes}`;

    const dateSpan = document.createElement('span');
    dateSpan.classList.add('date');
    dateSpan.textContent = dateString;

    const timeSpan = document.createElement('span');
    timeSpan.classList.add('time');
    timeSpan.textContent = timeString;

    timestampElement.appendChild(dateSpan);
    timestampElement.appendChild(timeSpan);

    const metaRightElement = document.createElement('div');
    metaRightElement.classList.add('post-meta-right');
    metaRightElement.appendChild(timestampElement);

    headerElement.appendChild(metaLeftElement);
    headerElement.appendChild(metaRightElement);
    commentElement.appendChild(headerElement);

    // Content Wrapper
    const contentWrapper = document.createElement('div');
    contentWrapper.classList.add('comment-content-wrapper');

    // Content
    const contentElement = document.createElement('div');
    contentElement.classList.add('post-content');

    // memo 필드 처리
    let content = comment.memo || '';
    content = content.replace(/\\r\\n/g, '\n');
    content = decodeHtmlEntities(content);
    contentElement.textContent = content;

    contentWrapper.appendChild(contentElement);
    commentElement.appendChild(contentWrapper);

    return commentElement;
}

// 페이지네이션 렌더링 함수
function renderPagination() {
    if (totalPages <= 1) {
        paginationTop.innerHTML = '';
        paginationBottom.innerHTML = '';
        return;
    }

    // 현재 URL 파라미터에서 board 파라미터 가져오기
    const urlParams = new URLSearchParams(window.location.search);
    const boardName = urlParams.get('board') || 'smgal_net_bbs';

    let paginationHtml = '';
    const pageGroupSize = 10;
    const currentGroup = Math.ceil(currentPage / pageGroupSize);
    const startPage = (currentGroup - 1) * pageGroupSize + 1;
    const endPage = Math.min(startPage + pageGroupSize - 1, totalPages);

    // '<<' (First Page)
    if (currentPage > 1) {
        paginationHtml += `<a href="?board=${boardName}&page=1">«</a>`;
    } else {
        paginationHtml += `<span class="disabled">«</span>`;
    }

    // '<' (Previous Group)
    if (currentGroup > 1) {
        const prevGroupPage = (currentGroup - 2) * pageGroupSize + 1;
        paginationHtml += `<a href="?board=${boardName}&page=${prevGroupPage}">‹</a>`;
    } else {
        paginationHtml += `<span class="disabled">‹</span>`;
    }

    // Page numbers
    for (let i = startPage; i <= endPage; i++) {
        if (i === currentPage) {
            paginationHtml += `<span class="current">${i}</span>`;
        } else {
            paginationHtml += `<a href="?board=${boardName}&page=${i}">${i}</a>`;
        }
    }

    // '>' (Next Group)
    if (currentGroup < Math.ceil(totalPages / pageGroupSize)) {
        const nextGroupPage = currentGroup * pageGroupSize + 1;
        paginationHtml += `<a href="?board=${boardName}&page=${nextGroupPage}">›</a>`;
    } else {
        paginationHtml += `<span class="disabled">›</span>`;
    }

    // '>>' (Last Page)
    if (currentPage < totalPages) {
        paginationHtml += `<a href="?board=${boardName}&page=${totalPages}">»</a>`;
    } else {
        paginationHtml += `<span class="disabled">»</span>`;
    }

    paginationTop.innerHTML = paginationHtml;
    paginationBottom.innerHTML = paginationHtml;
}

// 페이지 로드 시 데이터 로드
document.addEventListener('DOMContentLoaded', loadData);
