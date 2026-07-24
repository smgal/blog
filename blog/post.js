firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
const auth = firebase.auth();

const postContainer = document.getElementById('post-container');
const commentsContainer = document.getElementById('comments-container');
const visibleCommentCount = document.getElementById('visible-comment-count');
const commentForm = document.getElementById('comment-form');
const commentAuthorInput = document.getElementById('comment-author');
const commentEmailInput = document.getElementById('comment-email');
const commentHomepageInput = document.getElementById('comment-homepage');
const commentPasswordInput = document.getElementById('comment-password');
const commentContentInput = document.getElementById('comment-content');
const commentLoginState = document.getElementById('comment-login-state');
const submitCommentButton = document.getElementById('submit-comment');

let currentUser = null;
let currentPost = null;
let currentPostId = null;
let commentsUnsubscribe = null;

function isAdminUser(user = currentUser) {
    return Boolean(user && user.uid === ADMIN_UID);
}

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
        return heading
            ? `<h2>${renderInlineMarkdown(heading[1])}</h2>`
            : renderInlineMarkdown(line);
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

function safeHomepageUrl(value) {
    if (!value) return null;
    try {
        const withProtocol = /^https?:\/\//i.test(value) ? value : `https://${value}`;
        const parsed = new URL(withProtocol);
        return ['http:', 'https:'].includes(parsed.protocol) ? parsed.href : null;
    } catch (error) {
        return null;
    }
}

function appendAuthorMeta(container, item, numberText) {
    const number = document.createElement('span');
    number.className = 'post-number';
    number.textContent = numberText;
    container.appendChild(number);

    const author = document.createElement('span');
    author.className = 'author';
    author.textContent = item.author || '익명';
    container.appendChild(author);

    if (item.is_admin) {
        const badge = document.createElement('span');
        badge.className = 'admin-badge';
        badge.textContent = '운영자';
        container.appendChild(badge);
    }

    const homepageUrl = safeHomepageUrl(item.homepage);
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

function renderMainPost(post) {
    postContainer.innerHTML = '';
    const article = document.createElement('article');
    article.className = 'post';
    if (post.content_deleted) article.classList.add('content-deleted');

    const header = document.createElement('div');
    header.className = 'post-header';
    const metaLeft = document.createElement('div');
    metaLeft.className = 'post-meta-left';
    appendAuthorMeta(metaLeft, post, `#${post.post_number}`);

    if (post.category) {
        const category = document.createElement('a');
        category.className = 'category-label';
        category.href = `index.html?category=${encodeURIComponent(post.category)}`;
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

    article.appendChild(header);
    article.appendChild(titleBar);
    article.appendChild(content);
    postContainer.appendChild(article);
    document.title = `${post.title || '게시물'} - SMgal 블로그`;

    if (post.content_deleted) {
        commentForm.classList.add('hidden');
    } else {
        commentForm.classList.remove('hidden');
    }
}

function renderComment(comment) {
    const article = document.createElement('article');
    article.className = 'post comment';
    if (comment.is_admin) article.classList.add('admin-comment');

    if ((comment.password && !comment.is_admin) || isAdminUser()) {
        const deleteContainer = document.createElement('div');
        deleteContainer.className = 'comment-delete-container';
        const deleteButton = document.createElement('button');
        deleteButton.type = 'button';
        deleteButton.className = 'delete-button';
        deleteButton.textContent = 'DELETE';
        deleteButton.addEventListener('click', () => deleteComment(comment));
        deleteContainer.appendChild(deleteButton);
        article.appendChild(deleteContainer);
    }

    const header = document.createElement('div');
    header.className = 'post-header';
    const metaLeft = document.createElement('div');
    metaLeft.className = 'post-meta-left';
    appendAuthorMeta(metaLeft, comment, `#${currentPost.post_number}-${comment.comment_number}`);
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

function listenForComments(postId) {
    if (commentsUnsubscribe) commentsUnsubscribe();

    commentsUnsubscribe = db.collection('blog_comments')
        .where('post_id', '==', postId)
        .onSnapshot((snapshot) => {
            commentsContainer.innerHTML = '';
            const comments = snapshot.docs
                .map((doc) => ({ id: doc.id, ...doc.data() }))
                .filter((comment) => !comment.is_deleted)
                .sort((a, b) => {
                    const aTime = a.timestamp && typeof a.timestamp.toMillis === 'function'
                        ? a.timestamp.toMillis()
                        : 0;
                    const bTime = b.timestamp && typeof b.timestamp.toMillis === 'function'
                        ? b.timestamp.toMillis()
                        : 0;
                    return aTime - bTime;
                });
            visibleCommentCount.textContent = String(comments.length);

            if (comments.length === 0) {
                const empty = document.createElement('p');
                empty.className = 'empty-message';
                empty.textContent = '아직 댓글이 없습니다.';
                commentsContainer.appendChild(empty);
                return;
            }

            comments.forEach((comment) => commentsContainer.appendChild(renderComment(comment)));
        }, (error) => {
            console.error('Error loading comments:', error);
            commentsContainer.innerHTML = '<p class="error-message">댓글을 불러오는 데 실패했습니다.</p>';
        });
}

async function loadPost(postId) {
    try {
        const doc = await db.collection('blog_posts').doc(postId).get();
        if (!doc.exists || doc.data().is_deleted) {
            postContainer.innerHTML = '<p class="error-message">게시물을 찾을 수 없거나 삭제되었습니다.</p>';
            commentForm.classList.add('hidden');
            return;
        }

        currentPost = { id: doc.id, ...doc.data() };
        renderMainPost(currentPost);
        listenForComments(postId);
    } catch (error) {
        console.error('Error loading post:', error);
        postContainer.innerHTML = '<p class="error-message">게시물을 불러오는 데 실패했습니다.</p>';
        commentForm.classList.add('hidden');
    }
}

function updateCommentLoginState() {
    if (isAdminUser()) {
        commentLoginState.textContent = `${OWNER_NAME} 운영자 댓글로 등록됩니다.`;
        if (!commentAuthorInput.value.trim()) commentAuthorInput.value = OWNER_NAME;
        commentPasswordInput.disabled = true;
        commentPasswordInput.value = '';
        commentPasswordInput.placeholder = '운영자 댓글은 비밀번호가 필요 없습니다';
    } else {
        commentLoginState.textContent = '';
        commentPasswordInput.disabled = false;
        commentPasswordInput.placeholder = '비밀번호';
    }
}

commentForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!currentPostId || !currentPost || currentPost.content_deleted) {
        alert('댓글을 등록할 게시물을 찾을 수 없습니다.');
        return;
    }

    const isAdmin = isAdminUser();
    const author = commentAuthorInput.value.trim() || (isAdmin ? OWNER_NAME : '');
    const email = commentEmailInput.value.trim();
    const homepage = commentHomepageInput.value.trim();
    const password = isAdmin ? '' : commentPasswordInput.value;
    const content = commentContentInput.value.trim();

    if (!author || !content) {
        alert('이름과 내용을 모두 입력해주세요.');
        return;
    }

    if (!isAdmin && !password) {
        const confirmed = confirm('비밀번호를 설정하지 않으면 댓글을 삭제할 수 없습니다. 이대로 등록하시겠습니까?');
        if (!confirmed) return;
    }

    submitCommentButton.disabled = true;
    try {
        const hashedPassword = password ? await hashPassword(password) : null;
        const parentRef = db.collection('blog_posts').doc(currentPostId);

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
                post_id: currentPostId,
                comment_number: commentNumber,
                is_admin: isAdmin,
                is_deleted: false
            });
        });

        commentEmailInput.value = '';
        commentHomepageInput.value = '';
        commentPasswordInput.value = '';
        commentContentInput.value = '';
        if (!isAdmin) commentAuthorInput.value = '';
    } catch (error) {
        console.error('Error adding comment:', error);
        alert(error.message || '댓글 작성에 실패했습니다.');
    } finally {
        submitCommentButton.disabled = false;
    }
});

async function deleteComment(comment) {
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
        const hasOtherActiveComments = activeComments.docs.some((doc) => {
            return doc.id !== comment.id && !doc.data().is_deleted;
        });
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
        if (!hasOtherActiveComments && currentPost.content_deleted) {
            window.location.href = 'index.html';
        }
    } catch (error) {
        console.error('Error deleting comment:', error);
        alert('댓글 삭제 중 오류가 발생했습니다.');
    }
}

auth.onAuthStateChanged((user) => {
    currentUser = user;
    updateCommentLoginState();
    if (currentPostId && currentPost) listenForComments(currentPostId);
});

document.addEventListener('DOMContentLoaded', () => {
    const params = new URLSearchParams(window.location.search);
    currentPostId = params.get('id');
    if (!currentPostId) {
        postContainer.innerHTML = '<p class="error-message">게시물 ID가 없습니다.</p>';
        commentForm.classList.add('hidden');
        return;
    }
    loadPost(currentPostId);
});

window.addEventListener('beforeunload', () => {
    if (commentsUnsubscribe) commentsUnsubscribe();
});
