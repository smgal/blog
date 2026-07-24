firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
const auth = firebase.auth();

const postsContainer = document.getElementById('posts-container');
const categoryFilters = document.getElementById('category-filters');
const paginationTop = document.getElementById('pagination-top');
const paginationBottom = document.getElementById('pagination-bottom');
const toggleAllCommentsButton = document.getElementById('toggle-all-comments');

let allPosts = [];
let filteredPosts = [];
let currentCategory = '';
let currentPage = 1;
let currentUser = null;
const commentStates = new Map();
const postsPerPage = boardConfig.postsPerPage || 10;

function escapeHtml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function renderInlineMarkdown(escapedText) {
    const tokens = [];
    const saveToken = (html) => {
        const index = tokens.push(html) - 1;
        return `\u0001${index}\u0002`;
    };

    let rendered = escapedText.replace(/`([^`\n]+)`/g, (_, code) => {
        return saveToken(`<code>${code}</code>`);
    });

    rendered = rendered.replace(/\[([^\]\n]+)\]\(([^)\s]+)\)/g, (match, label, url) => {
        try {
            const parsed = new URL(url.replace(/&amp;/g, '&'), window.location.href);
            if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
                return match;
            }
            return saveToken(
                `<a href="${url}" target="_blank" rel="noopener noreferrer">${label}</a>`
            );
        } catch (error) {
            return match;
        }
    });

    rendered = rendered.replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>');
    rendered = rendered.replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<em>$2</em>');

    return rendered.replace(/\u0001(\d+)\u0002/g, (_, index) => tokens[Number(index)]);
}

function renderMarkdown(source) {
    const escaped = escapeHtml(source).replace(/\r\n?/g, '\n');
    return escaped.split('\n').map((line) => {
        const heading = line.match(/^##\s+(.+)$/);
        if (heading) {
            return `<h2>${renderInlineMarkdown(heading[1])}</h2>`;
        }
        return renderInlineMarkdown(line);
    }).join('<br>');
}

function formatTimestamp(timestamp) {
    if (!timestamp || typeof timestamp.toDate !== 'function') {
        return { date: '방금 전', time: '' };
    }

    const value = timestamp.toDate();
    const days = ['일', '월', '화', '수', '목', '금', '토'];
    const date = `${value.getFullYear()}/${String(value.getMonth() + 1).padStart(2, '0')}/${String(value.getDate()).padStart(2, '0')} (${days[value.getDay()]})`;
    let hours = value.getHours();
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12 || 12;
    const time = `${ampm} ${String(hours).padStart(2, '0')}:${String(value.getMinutes()).padStart(2, '0')}`;
    return { date, time };
}

function createTimestampElement(timestamp) {
    const formatted = formatTimestamp(timestamp);
    const wrapper = document.createElement('span');
    wrapper.className = 'post-timestamp';

    const date = document.createElement('span');
    date.className = 'date';
    date.textContent = formatted.date;
    wrapper.appendChild(date);

    if (formatted.time) {
        const time = document.createElement('span');
        time.className = 'time';
        time.textContent = formatted.time;
        wrapper.appendChild(time);
    }
    return wrapper;
}

function timestampMillis(timestamp) {
    if (!timestamp) return 0;
    if (typeof timestamp.toMillis === 'function') return timestamp.toMillis();
    return timestamp.seconds ? timestamp.seconds * 1000 : 0;
}

function isAdminUser(user = currentUser) {
    return Boolean(user && typeof ADMIN_UID === 'string' && user.uid === ADMIN_UID);
}

function safeHomepageUrl(value) {
    if (!value) return '';

    try {
        const url = new URL(value);
        return ['http:', 'https:'].includes(url.protocol) ? url.href : '';
    } catch (error) {
        return '';
    }
}

function pageUrl(page, category = currentCategory) {
    const params = new URLSearchParams();
    if (category) params.set('category', category);
    if (page > 1) params.set('page', String(page));
    const query = params.toString();
    return query ? `?${query}` : 'index.html';
}

function renderCategoryFilters() {
    const categories = [...new Set(
        allPosts
            .map((post) => String(post.category || '').trim())
            .filter(Boolean)
    )].sort((a, b) => a.localeCompare(b, 'ko'));

    if (currentCategory && !categories.includes(currentCategory)) {
        currentCategory = '';
    }

    categoryFilters.innerHTML = '';
    const filters = [{ name: '전체', value: '' }, ...categories.map((name) => ({ name, value: name }))];

    filters.forEach((filter) => {
        const link = document.createElement('a');
        link.className = 'category-button';
        if (filter.value === currentCategory) link.classList.add('active');
        link.href = pageUrl(1, filter.value);
        link.textContent = filter.name;
        link.setAttribute('aria-current', filter.value === currentCategory ? 'page' : 'false');
        categoryFilters.appendChild(link);
    });
}

function stopInlineCommentListeners() {
    commentStates.forEach((state) => {
        if (typeof state.unsubscribe === 'function') {
            state.unsubscribe();
        }
    });
    commentStates.clear();
}

function updatePostCommentToggle(state) {
    const count = state.comments.length;
    state.toggleButton.textContent = state.expanded
        ? `댓글 접기 (${count})`
        : `댓글 열기 (${count})`;
}

function setCommentsExpanded(state, expanded) {
    state.expanded = expanded;
    state.region.hidden = !expanded;
    state.toggleButton.setAttribute('aria-expanded', String(expanded));
    updatePostCommentToggle(state);

    if (!expanded && state.form && !state.form.hidden) {
        state.form.hidden = true;
        state.writeButton.setAttribute('aria-expanded', 'false');
        state.writeButton.textContent = '댓글 쓰기';
    }
}

function syncGlobalCommentsToggle() {
    const states = Array.from(commentStates.values());

    if (states.length === 0) {
        toggleAllCommentsButton.disabled = true;
        toggleAllCommentsButton.setAttribute('aria-checked', 'false');
        toggleAllCommentsButton.textContent = '댓글 없음';
        return;
    }

    const allExpanded = states.every((state) => state.expanded);
    toggleAllCommentsButton.disabled = false;
    toggleAllCommentsButton.setAttribute('aria-checked', String(allExpanded));
    toggleAllCommentsButton.textContent = allExpanded ? '댓글 모두 접기' : '댓글 모두 열기';
}

function updateInlineFormAuthState(state) {
    if (!state.form) return;

    const authorInput = state.form.elements.author;
    const passwordInput = state.form.elements.password;
    const admin = isAdminUser();

    passwordInput.disabled = admin;
    passwordInput.placeholder = admin
        ? '운영자는 비밀번호가 필요 없습니다'
        : '삭제 시 필요 (선택)';

    if (admin) {
        passwordInput.value = '';
        if (!authorInput.value.trim()) authorInput.value = OWNER_NAME;
    }
}

function appendInlineCommentAuthor(container, comment, state) {
    const number = document.createElement('span');
    number.className = 'post-number';
    number.textContent = `#${state.post.post_number}-${comment.comment_number}`;
    container.appendChild(number);

    const author = document.createElement('span');
    author.className = 'author';
    author.textContent = comment.author || '익명';
    container.appendChild(author);

    if (comment.is_admin) {
        const badge = document.createElement('span');
        badge.className = 'admin-badge';
        badge.textContent = '운영자';
        container.appendChild(badge);
    }

    const homepageUrl = safeHomepageUrl(comment.homepage);
    if (homepageUrl) {
        const homepage = document.createElement('a');
        homepage.className = 'homepage-link';
        homepage.href = homepageUrl;
        homepage.target = '_blank';
        homepage.rel = 'noopener noreferrer';
        homepage.textContent = '[홈페이지]';
        container.appendChild(homepage);
    }
}

function renderInlineComment(comment, state) {
    const article = document.createElement('article');
    article.className = 'post comment inline-comment';
    if (comment.is_admin) article.classList.add('admin-comment');

    if ((comment.password && !comment.is_admin) || isAdminUser()) {
        const deleteContainer = document.createElement('div');
        deleteContainer.className = 'comment-delete-container';
        const deleteButton = document.createElement('button');
        deleteButton.type = 'button';
        deleteButton.className = 'delete-button';
        deleteButton.textContent = 'DELETE';
        deleteButton.addEventListener('click', () => deleteInlineComment(comment, state));
        deleteContainer.appendChild(deleteButton);
        article.appendChild(deleteContainer);
    }

    const header = document.createElement('div');
    header.className = 'post-header';
    const metaLeft = document.createElement('div');
    metaLeft.className = 'post-meta-left';
    appendInlineCommentAuthor(metaLeft, comment, state);
    header.appendChild(metaLeft);
    header.appendChild(createTimestampElement(comment.timestamp));

    const wrapper = document.createElement('div');
    wrapper.className = 'comment-content-wrapper';
    const content = document.createElement('div');
    content.className = 'post-content';
    content.textContent = comment.content || '';
    wrapper.appendChild(content);

    article.appendChild(header);
    article.appendChild(wrapper);
    return article;
}

function renderInlineComments(state) {
    state.list.innerHTML = '';
    state.region.classList.toggle('no-comments', state.comments.length === 0);

    if (state.comments.length > 0) {
        state.comments.forEach((comment) => {
            state.list.appendChild(renderInlineComment(comment, state));
        });
    }

    updatePostCommentToggle(state);
}

async function submitInlineComment(event, state) {
    event.preventDefault();

    const form = state.form;
    const submitButton = form.querySelector('button[type="submit"]');
    const admin = isAdminUser();
    const author = form.elements.author.value.trim() || (admin ? OWNER_NAME : '');
    const email = form.elements.email.value.trim();
    const homepage = form.elements.homepage.value.trim();
    const password = admin ? '' : form.elements.password.value;
    const content = form.elements.content.value.trim();

    if (!author || !content) {
        alert('이름과 내용을 모두 입력해주세요.');
        return;
    }

    if (!admin && !password) {
        const confirmed = confirm(
            '비밀번호를 설정하지 않으면 댓글을 삭제할 수 없습니다. 이대로 등록하시겠습니까?'
        );
        if (!confirmed) return;
    }

    submitButton.disabled = true;

    try {
        const hashedPassword = password ? await hashPassword(password) : null;
        const parentRef = db.collection('blog_posts').doc(state.post.id);

        await db.runTransaction(async (transaction) => {
            const parentDoc = await transaction.get(parentRef);
            if (!parentDoc.exists || parentDoc.data().is_deleted || parentDoc.data().content_deleted) {
                throw new Error('댓글을 등록할 수 없는 게시물입니다.');
            }

            const commentNumber = (Number(parentDoc.data().comment_count) || 0) + 1;
            transaction.update(parentRef, { comment_count: commentNumber });
            transaction.set(db.collection('blog_comments').doc(), {
                author,
                email,
                homepage,
                content,
                password: hashedPassword,
                timestamp: firebase.firestore.FieldValue.serverTimestamp(),
                post_id: state.post.id,
                comment_number: commentNumber,
                is_admin: admin,
                is_deleted: false
            });
        });

        form.reset();
        updateInlineFormAuthState(state);
        form.hidden = true;
        state.writeButton.setAttribute('aria-expanded', 'false');
        state.writeButton.textContent = '댓글 쓰기';
    } catch (error) {
        console.error('Error adding comment:', error);
        alert(error.message || '댓글 작성에 실패했습니다.');
    } finally {
        submitButton.disabled = false;
    }
}

async function deleteInlineComment(comment, state) {
    if (!isAdminUser()) {
        const password = prompt('삭제하려면 비밀번호를 입력하세요.');
        if (!password) return;
        if (!comment.password) {
            alert('이 댓글에는 비밀번호가 설정되어 있지 않아 삭제할 수 없습니다.');
            return;
        }
        const hashedPassword = await hashPassword(password);
        if (hashedPassword !== comment.password) {
            alert('비밀번호가 일치하지 않습니다.');
            return;
        }
    }

    if (!confirm('정말로 이 댓글을 삭제하시겠습니까?')) return;

    try {
        const activeComments = await db.collection('blog_comments')
            .where('post_id', '==', comment.post_id)
            .get();
        const hasOtherActiveComments = activeComments.docs.some((doc) => (
            doc.id !== comment.id && !doc.data().is_deleted
        ));
        const parentRef = db.collection('blog_posts').doc(comment.post_id);
        const batch = db.batch();
        batch.update(db.collection('blog_comments').doc(comment.id), { is_deleted: true });

        if (!hasOtherActiveComments) {
            const parentDoc = await parentRef.get();
            if (parentDoc.exists && parentDoc.data().content_deleted) {
                batch.update(parentRef, { is_deleted: true });
            }
        }

        await batch.commit();
        if (!hasOtherActiveComments && state.post.content_deleted) {
            window.location.reload();
        }
    } catch (error) {
        console.error('Error deleting comment:', error);
        alert('댓글 삭제 중 오류가 발생했습니다.');
    }
}

function createInlineCommentForm(state) {
    const form = document.createElement('form');
    form.className = 'post-form inline-comment-form';
    form.hidden = true;
    form.innerHTML = `
        <h2>댓글 쓰기</h2>
        <div class="form-row">
            <input type="text" name="author" maxlength="80" placeholder="이름" autocomplete="name" required>
            <input type="email" name="email" maxlength="200" placeholder="이메일 (선택)" autocomplete="email">
        </div>
        <div class="form-row">
            <input type="url" name="homepage" maxlength="500" placeholder="홈페이지 (선택)">
            <input type="password" name="password" maxlength="100" placeholder="삭제 시 필요 (선택)" autocomplete="new-password">
        </div>
        <textarea name="content" maxlength="10000" placeholder="댓글 내용" required></textarea>
        <button type="submit" class="inline-comment-submit">댓글 등록</button>
    `;
    form.addEventListener('submit', (event) => submitInlineComment(event, state));
    return form;
}

function listenForInlineComments(state) {
    state.unsubscribe = db.collection('blog_comments')
        .where('post_id', '==', state.post.id)
        .onSnapshot((snapshot) => {
            state.comments = snapshot.docs
                .map((doc) => ({ id: doc.id, ...doc.data() }))
                .filter((comment) => !comment.is_deleted)
                .sort((a, b) => timestampMillis(a.timestamp) - timestampMillis(b.timestamp));
            renderInlineComments(state);
        }, (error) => {
            console.error('Error loading comments:', error);
            state.list.innerHTML = '<p class="error-message">댓글을 불러오는 데 실패했습니다.</p>';
        });
}

function renderPostCard(post) {
    const article = document.createElement('article');
    article.className = 'post';
    if (post.content_deleted) article.classList.add('content-deleted');

    const header = document.createElement('div');
    header.className = 'post-header';

    const metaLeft = document.createElement('div');
    metaLeft.className = 'post-meta-left';

    const number = document.createElement('span');
    number.className = 'post-number';
    number.textContent = `#${post.post_number}`;
    metaLeft.appendChild(number);

    const author = document.createElement('span');
    author.className = 'author';
    author.textContent = post.author || OWNER_NAME;
    metaLeft.appendChild(author);

    if (post.category) {
        const category = document.createElement('a');
        category.className = 'category-label';
        category.href = pageUrl(1, post.category);
        category.textContent = post.category;
        metaLeft.appendChild(category);
    }

    if (post.is_pinned && !post.content_deleted) {
        const pinned = document.createElement('span');
        pinned.className = 'pinned-badge';
        pinned.textContent = '상단 고정';
        metaLeft.appendChild(pinned);
    }

    header.appendChild(metaLeft);

    const titleBar = document.createElement('div');
    titleBar.className = 'post-title-bar';

    const title = document.createElement('span');
    title.className = 'post-title';
    title.textContent = post.title || '(제목 없음)';
    titleBar.appendChild(title);
    titleBar.appendChild(createTimestampElement(post.timestamp));

    const content = document.createElement('div');
    content.className = 'post-content markdown-content';
    if (post.content_deleted) {
        content.textContent = '삭제된 글입니다.';
    } else {
        content.innerHTML = renderMarkdown(post.content || '');
    }

    const commentActions = document.createElement('div');
    commentActions.className = 'post-meta-right post-comment-actions';

    const commentsRegionId = `comments-${post.id}`;
    const commentsToggle = document.createElement('button');
    commentsToggle.type = 'button';
    commentsToggle.className = 'comments-toggle-button';
    commentsToggle.setAttribute('aria-expanded', 'true');
    commentsToggle.setAttribute('aria-controls', commentsRegionId);

    const writeButton = document.createElement('button');
    writeButton.type = 'button';
    writeButton.className = 'comment-write-button';
    writeButton.textContent = '댓글 쓰기';
    writeButton.setAttribute('aria-expanded', 'false');

    commentActions.appendChild(commentsToggle);
    if (!post.content_deleted) commentActions.appendChild(writeButton);
    header.appendChild(commentActions);

    const commentsRegion = document.createElement('section');
    commentsRegion.id = commentsRegionId;
    commentsRegion.className = 'inline-comments-region no-comments';
    commentsRegion.setAttribute('aria-label', `${post.title || '글'}의 댓글`);

    const commentsList = document.createElement('div');
    commentsList.className = 'inline-comments-list';
    commentsRegion.appendChild(commentsList);

    article.appendChild(header);
    article.appendChild(titleBar);
    article.appendChild(content);
    article.appendChild(commentsRegion);

    const state = {
        post,
        region: commentsRegion,
        list: commentsList,
        toggleButton: commentsToggle,
        writeButton,
        form: null,
        comments: [],
        expanded: true,
        unsubscribe: null
    };

    if (!post.content_deleted) {
        state.form = createInlineCommentForm(state);
        commentsRegion.appendChild(state.form);
        updateInlineFormAuthState(state);

        writeButton.addEventListener('click', () => {
            if (!state.expanded) setCommentsExpanded(state, true);

            state.form.hidden = !state.form.hidden;
            const formIsOpen = !state.form.hidden;
            writeButton.setAttribute('aria-expanded', String(formIsOpen));
            writeButton.textContent = formIsOpen ? '작성 취소' : '댓글 쓰기';

            if (formIsOpen) state.form.elements.content.focus();
            syncGlobalCommentsToggle();
        });
    }

    commentsToggle.addEventListener('click', () => {
        setCommentsExpanded(state, !state.expanded);
        syncGlobalCommentsToggle();
    });

    commentStates.set(post.id, state);
    updatePostCommentToggle(state);
    listenForInlineComments(state);
    return article;
}

function renderPosts() {
    stopInlineCommentListeners();
    const start = (currentPage - 1) * postsPerPage;
    const posts = filteredPosts.slice(start, start + postsPerPage);
    postsContainer.innerHTML = '';

    if (posts.length === 0) {
        const empty = document.createElement('p');
        empty.className = 'empty-message';
        empty.textContent = '표시할 게시물이 없습니다.';
        postsContainer.appendChild(empty);
        syncGlobalCommentsToggle();
        return;
    }

    posts.forEach((post) => postsContainer.appendChild(renderPostCard(post)));
    syncGlobalCommentsToggle();
}

function renderPagination() {
    const totalPages = Math.max(1, Math.ceil(filteredPosts.length / postsPerPage));
    if (currentPage > totalPages) currentPage = totalPages;
    if (currentPage < 1) currentPage = 1;

    if (totalPages <= 1) {
        paginationTop.innerHTML = '';
        paginationBottom.innerHTML = '';
        return;
    }

    const groupSize = 10;
    const group = Math.ceil(currentPage / groupSize);
    const start = (group - 1) * groupSize + 1;
    const end = Math.min(start + groupSize - 1, totalPages);
    let html = currentPage > 1
        ? `<a href="${pageUrl(1)}" aria-label="첫 페이지">«</a>`
        : '<span class="disabled">«</span>';

    if (start > 1) {
        html += `<a href="${pageUrl(start - 1)}" aria-label="이전 페이지 묶음">‹</a>`;
    } else {
        html += '<span class="disabled">‹</span>';
    }

    for (let page = start; page <= end; page += 1) {
        html += page === currentPage
            ? `<span class="current" aria-current="page">${page}</span>`
            : `<a href="${pageUrl(page)}">${page}</a>`;
    }

    if (end < totalPages) {
        html += `<a href="${pageUrl(end + 1)}" aria-label="다음 페이지 묶음">›</a>`;
    } else {
        html += '<span class="disabled">›</span>';
    }

    html += currentPage < totalPages
        ? `<a href="${pageUrl(totalPages)}" aria-label="마지막 페이지">»</a>`
        : '<span class="disabled">»</span>';

    paginationTop.innerHTML = html;
    paginationBottom.innerHTML = html;
}

function applyFilters() {
    filteredPosts = allPosts
        .filter((post) => !currentCategory || post.category === currentCategory)
        .sort((a, b) => {
            const pinnedDifference = Number(Boolean(b.is_pinned)) - Number(Boolean(a.is_pinned));
            return pinnedDifference || (Number(b.post_number) - Number(a.post_number));
        });

    const totalPages = Math.max(1, Math.ceil(filteredPosts.length / postsPerPage));
    currentPage = Math.min(Math.max(currentPage, 1), totalPages);
    renderPagination();
    renderPosts();
}

async function initBlog() {
    const params = new URLSearchParams(window.location.search);
    currentCategory = params.get('category') || '';
    currentPage = Number.parseInt(params.get('page'), 10) || 1;

    try {
        const snapshot = await db.collection('blog_posts')
            .where('is_deleted', '==', false)
            .get();

        allPosts = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
        renderCategoryFilters();
        applyFilters();
    } catch (error) {
        console.error('Error fetching blog posts:', error);
        postsContainer.innerHTML = '<p class="error-message">게시물을 불러오는 데 실패했습니다.</p>';
        categoryFilters.innerHTML = '';
        paginationTop.innerHTML = '';
        paginationBottom.innerHTML = '';
    }
}

toggleAllCommentsButton.addEventListener('click', () => {
    const states = Array.from(commentStates.values());
    const allExpanded = states.length > 0 && states.every((state) => state.expanded);
    states.forEach((state) => setCommentsExpanded(state, !allExpanded));
    syncGlobalCommentsToggle();
});

auth.onAuthStateChanged((user) => {
    currentUser = user;
    commentStates.forEach((state) => {
        updateInlineFormAuthState(state);
        renderInlineComments(state);
    });
});

document.addEventListener('DOMContentLoaded', initBlog);

window.addEventListener('beforeunload', stopInlineCommentListeners);
