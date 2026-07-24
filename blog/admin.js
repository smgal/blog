firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
const auth = firebase.auth();
auth.useDeviceLanguage();

const authStatus = document.getElementById('auth-status');
const signInButton = document.getElementById('sign-in-button');
const signOutButton = document.getElementById('sign-out-button');
const dashboard = document.getElementById('admin-dashboard');

const postForm = document.getElementById('admin-post-form');
const postFormHeading = document.getElementById('post-form-heading');
const editPostIdInput = document.getElementById('edit-post-id');
const postTitleInput = document.getElementById('admin-post-title');
const postCategorySelect = document.getElementById('admin-post-category');
const postContentInput = document.getElementById('admin-post-content');
const postPinnedInput = document.getElementById('admin-post-pinned');
const cancelPostEditButton = document.getElementById('cancel-post-edit');
const savePostButton = document.getElementById('save-post-button');
const adminPostsList = document.getElementById('admin-posts-list');

const categoryForm = document.getElementById('category-form');
const editCategoryIdInput = document.getElementById('edit-category-id');
const categoryNameInput = document.getElementById('category-name');
const categoryOrderInput = document.getElementById('category-order');
const cancelCategoryEditButton = document.getElementById('cancel-category-edit');
const categoriesAdminList = document.getElementById('categories-admin-list');

const adminCommentsList = document.getElementById('admin-comments-list');

let adminUser = null;
let categories = [];
let adminPosts = [];
let adminComments = [];
let adminPostsById = new Map();

function isAdminUser(user = adminUser) {
    return Boolean(user && user.uid === ADMIN_UID);
}

function requireAdmin() {
    if (!isAdminUser()) {
        alert('관리자 권한이 필요합니다.');
        return false;
    }
    return true;
}

function formatTimestamp(timestamp) {
    if (!timestamp || typeof timestamp.toDate !== 'function') return '시간 미정';
    return timestamp.toDate().toLocaleString('ko-KR', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
    });
}

function createButton(label, className, handler) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = className;
    button.textContent = label;
    button.addEventListener('click', handler);
    return button;
}

function addStatusBadge(container, label, deleted = false) {
    const badge = document.createElement('span');
    badge.className = `status-badge${deleted ? ' deleted' : ''}`;
    badge.textContent = label;
    container.appendChild(badge);
}

async function loadDashboard() {
    if (!requireAdmin()) return;
    await loadCategories();
    await loadPosts();
    await loadComments();
}

async function loadCategories() {
    try {
        const snapshot = await db.collection('categories').orderBy('order', 'asc').get();
        categories = snapshot.docs
            .map((doc) => ({ id: doc.id, ...doc.data() }))
            .sort((a, b) => (Number(a.order) - Number(b.order)) || String(a.name).localeCompare(String(b.name), 'ko'));
        populateCategorySelect();
        renderCategories();
    } catch (error) {
        console.error('Error loading categories:', error);
        categoriesAdminList.innerHTML = '<p class="error-message">카테고리를 불러오지 못했습니다.</p>';
    }
}

function populateCategorySelect(selectedValue = postCategorySelect.value) {
    postCategorySelect.innerHTML = '<option value="">카테고리 선택</option>';
    categories.forEach((category) => {
        const option = document.createElement('option');
        option.value = category.name;
        option.textContent = category.name;
        postCategorySelect.appendChild(option);
    });

    if (selectedValue && !categories.some((category) => category.name === selectedValue)) {
        const legacyOption = document.createElement('option');
        legacyOption.value = selectedValue;
        legacyOption.textContent = `${selectedValue} (기존 값)`;
        postCategorySelect.appendChild(legacyOption);
    }
    postCategorySelect.value = selectedValue || '';
}

function renderCategories() {
    categoriesAdminList.innerHTML = '';
    if (categories.length === 0) {
        categoriesAdminList.innerHTML = '<p class="empty-message">먼저 카테고리를 만들어 주세요.</p>';
        return;
    }

    categories.forEach((category) => {
        const item = document.createElement('div');
        item.className = 'admin-list-item';

        const heading = document.createElement('div');
        heading.className = 'admin-item-heading';
        const name = document.createElement('strong');
        name.textContent = category.name;
        heading.appendChild(name);
        const order = document.createElement('span');
        order.textContent = `순서 ${Number(category.order) || 0}`;
        heading.appendChild(order);

        const actions = document.createElement('div');
        actions.className = 'admin-item-actions';
        actions.appendChild(createButton('수정', 'secondary-button', () => beginCategoryEdit(category)));
        actions.appendChild(createButton('삭제', 'danger-button', () => deleteCategory(category)));

        item.appendChild(heading);
        item.appendChild(actions);
        categoriesAdminList.appendChild(item);
    });
}

function beginCategoryEdit(category) {
    editCategoryIdInput.value = category.id;
    categoryNameInput.value = category.name;
    categoryOrderInput.value = String(Number(category.order) || 0);
    cancelCategoryEditButton.classList.remove('hidden');
    categoryNameInput.focus();
}

function resetCategoryForm() {
    categoryForm.reset();
    editCategoryIdInput.value = '';
    categoryOrderInput.value = '0';
    cancelCategoryEditButton.classList.add('hidden');
}

categoryForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!requireAdmin()) return;

    const id = editCategoryIdInput.value;
    const name = categoryNameInput.value.trim();
    const order = Number.parseInt(categoryOrderInput.value, 10) || 0;
    if (!name) return;

    const duplicate = categories.find((category) => category.name === name && category.id !== id);
    if (duplicate) {
        alert('같은 이름의 카테고리가 이미 있습니다.');
        return;
    }

    try {
        if (id) {
            await db.collection('categories').doc(id).update({ name, order });
        } else {
            await db.collection('categories').add({ name, order });
        }
        resetCategoryForm();
        await loadCategories();
    } catch (error) {
        console.error('Error saving category:', error);
        alert('카테고리 저장에 실패했습니다.');
    }
});

async function deleteCategory(category) {
    if (!requireAdmin()) return;
    if (!confirm(`"${category.name}" 카테고리를 삭제하시겠습니까?\n기존 글의 카테고리 값은 바뀌지 않습니다.`)) return;
    try {
        await db.collection('categories').doc(category.id).delete();
        await loadCategories();
    } catch (error) {
        console.error('Error deleting category:', error);
        alert('카테고리 삭제에 실패했습니다.');
    }
}

async function loadPosts() {
    adminPostsList.innerHTML = '<p class="loading-message">글을 불러오는 중...</p>';
    try {
        const snapshot = await db.collection('blog_posts').orderBy('post_number', 'desc').get();
        adminPosts = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
        adminPostsById = new Map(adminPosts.map((post) => [post.id, post]));
        renderAdminPosts();
    } catch (error) {
        console.error('Error loading admin posts:', error);
        adminPostsList.innerHTML = '<p class="error-message">글을 불러오지 못했습니다.</p>';
    }
}

function renderAdminPosts() {
    adminPostsList.innerHTML = '';
    if (adminPosts.length === 0) {
        adminPostsList.innerHTML = '<p class="empty-message">아직 작성한 글이 없습니다.</p>';
        return;
    }

    adminPosts.forEach((post) => {
        const item = document.createElement('article');
        item.className = 'admin-list-item';

        const heading = document.createElement('div');
        heading.className = 'admin-item-heading';
        const title = document.createElement('strong');
        title.textContent = `#${post.post_number} ${post.title || '(제목 없음)'}`;
        heading.appendChild(title);
        const statuses = document.createElement('span');
        if (post.is_pinned && !post.is_deleted) addStatusBadge(statuses, '고정');
        if (post.content_deleted) addStatusBadge(statuses, '본문 삭제', true);
        if (post.is_deleted) addStatusBadge(statuses, '삭제됨', true);
        heading.appendChild(statuses);

        const meta = document.createElement('div');
        meta.className = 'admin-item-meta';
        const category = document.createElement('span');
        category.textContent = post.category || '카테고리 없음';
        const date = document.createElement('span');
        date.textContent = formatTimestamp(post.updated_at || post.timestamp);
        const comments = document.createElement('span');
        comments.textContent = `댓글 번호 ${Number(post.comment_count) || 0}`;
        meta.append(category, date, comments);

        const excerpt = document.createElement('div');
        excerpt.className = 'admin-item-content';
        const originalContent = post.content || '';
        excerpt.textContent = originalContent.length > 240
            ? `${originalContent.slice(0, 240)}…`
            : originalContent;

        const actions = document.createElement('div');
        actions.className = 'admin-item-actions';
        if (!post.is_deleted && !post.content_deleted) {
            actions.appendChild(createButton('수정', 'secondary-button', () => beginPostEdit(post)));
            actions.appendChild(createButton(post.is_pinned ? '고정 해제' : '상단 고정', 'secondary-button', () => togglePinned(post)));
        }
        if (post.is_deleted && !post.content_deleted) {
            actions.appendChild(createButton('복구', 'secondary-button', () => restorePost(post)));
        }
        if (!post.is_deleted) {
            actions.appendChild(createButton('삭제', 'danger-button', () => deletePost(post)));
        }

        item.append(heading, meta, excerpt, actions);
        adminPostsList.appendChild(item);
    });
}

function beginPostEdit(post) {
    editPostIdInput.value = post.id;
    postTitleInput.value = post.title || '';
    populateCategorySelect(post.category || '');
    postContentInput.value = post.content || '';
    postPinnedInput.checked = Boolean(post.is_pinned);
    postFormHeading.textContent = `#${post.post_number} 글 수정`;
    savePostButton.textContent = '수정 저장';
    cancelPostEditButton.classList.remove('hidden');
    postTitleInput.focus();
    postForm.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function resetPostForm() {
    postForm.reset();
    editPostIdInput.value = '';
    postFormHeading.textContent = '새 글 작성';
    savePostButton.textContent = '글 저장';
    cancelPostEditButton.classList.add('hidden');
    populateCategorySelect('');
}

postForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!requireAdmin()) return;

    const id = editPostIdInput.value;
    const title = postTitleInput.value.trim();
    const category = postCategorySelect.value.trim();
    const content = postContentInput.value.trim();
    const isPinned = postPinnedInput.checked;
    if (!title || !category || !content) {
        alert('제목, 카테고리, 본문을 모두 입력해주세요.');
        return;
    }

    savePostButton.disabled = true;
    try {
        if (id) {
            await db.collection('blog_posts').doc(id).update({
                title,
                content,
                category,
                is_pinned: isPinned,
                updated_at: firebase.firestore.FieldValue.serverTimestamp()
            });
        } else {
            const counterRef = db.collection('counters').doc('blog_posts');
            await db.runTransaction(async (transaction) => {
                const counterDoc = await transaction.get(counterRef);
                const postNumber = counterDoc.exists
                    ? (Number(counterDoc.data().count) || 0) + 1
                    : 1;
                transaction.set(counterRef, { count: postNumber });
                transaction.set(db.collection('blog_posts').doc(), {
                    author: OWNER_NAME,
                    title,
                    content,
                    category,
                    timestamp: firebase.firestore.FieldValue.serverTimestamp(),
                    updated_at: firebase.firestore.FieldValue.serverTimestamp(),
                    post_number: postNumber,
                    is_pinned: isPinned,
                    comment_count: 0,
                    is_deleted: false,
                    content_deleted: false
                });
            });
        }

        resetPostForm();
        await loadPosts();
    } catch (error) {
        console.error('Error saving post:', error);
        alert('글 저장에 실패했습니다.');
    } finally {
        savePostButton.disabled = false;
    }
});

async function togglePinned(post) {
    if (!requireAdmin()) return;
    try {
        await db.collection('blog_posts').doc(post.id).update({
            is_pinned: !post.is_pinned,
            updated_at: firebase.firestore.FieldValue.serverTimestamp()
        });
        await loadPosts();
    } catch (error) {
        console.error('Error toggling pinned state:', error);
        alert('고정 상태 변경에 실패했습니다.');
    }
}

async function deletePost(post) {
    if (!requireAdmin()) return;
    if (!confirm(`"${post.title}" 글을 삭제하시겠습니까?`)) return;

    try {
        const comments = await db.collection('blog_comments')
            .where('post_id', '==', post.id)
            .get();
        const hasActiveComments = comments.docs.some((doc) => !doc.data().is_deleted);
        const update = {
            is_pinned: false,
            updated_at: firebase.firestore.FieldValue.serverTimestamp()
        };

        if (!hasActiveComments) {
            update.is_deleted = true;
        } else {
            update.content_deleted = true;
            update.title = '(삭제됨)';
            update.content = '삭제된 글입니다.';
        }

        await db.collection('blog_posts').doc(post.id).update(update);
        resetPostForm();
        await loadPosts();
    } catch (error) {
        console.error('Error deleting post:', error);
        alert('글 삭제에 실패했습니다.');
    }
}

async function restorePost(post) {
    if (!requireAdmin()) return;
    if (!confirm(`"${post.title}" 글을 복구하시겠습니까?`)) return;
    try {
        await db.collection('blog_posts').doc(post.id).update({
            is_deleted: false,
            updated_at: firebase.firestore.FieldValue.serverTimestamp()
        });
        await loadPosts();
    } catch (error) {
        console.error('Error restoring post:', error);
        alert('글 복구에 실패했습니다.');
    }
}

async function loadComments() {
    adminCommentsList.innerHTML = '<p class="loading-message">댓글을 불러오는 중...</p>';
    try {
        const snapshot = await db.collection('blog_comments').orderBy('timestamp', 'desc').get();
        adminComments = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
        renderAdminComments();
    } catch (error) {
        console.error('Error loading admin comments:', error);
        adminCommentsList.innerHTML = '<p class="error-message">댓글을 불러오지 못했습니다.</p>';
    }
}

function renderAdminComments() {
    adminCommentsList.innerHTML = '';
    if (adminComments.length === 0) {
        adminCommentsList.innerHTML = '<p class="empty-message">아직 댓글이 없습니다.</p>';
        return;
    }

    adminComments.forEach((comment) => {
        const parent = adminPostsById.get(comment.post_id);
        const item = document.createElement('article');
        item.className = 'admin-list-item';

        const heading = document.createElement('div');
        heading.className = 'admin-item-heading';
        const author = document.createElement('strong');
        author.textContent = `${comment.author || '익명'} · #${parent ? parent.post_number : '?'}-${comment.comment_number}`;
        heading.appendChild(author);
        const statuses = document.createElement('span');
        if (comment.is_admin) addStatusBadge(statuses, '운영자');
        if (comment.is_deleted) addStatusBadge(statuses, '삭제됨', true);
        heading.appendChild(statuses);

        const meta = document.createElement('div');
        meta.className = 'admin-item-meta';
        const parentTitle = document.createElement('span');
        parentTitle.textContent = parent ? parent.title : '원문 없음';
        const date = document.createElement('span');
        date.textContent = formatTimestamp(comment.timestamp);
        const email = document.createElement('span');
        email.textContent = comment.email || '이메일 없음';
        meta.append(parentTitle, date, email);

        const content = document.createElement('div');
        content.className = 'admin-item-content';
        content.textContent = comment.content || '';

        const actions = document.createElement('div');
        actions.className = 'admin-item-actions';
        if (!comment.is_deleted) {
            actions.appendChild(createButton('수정', 'secondary-button', () => editComment(comment)));
            actions.appendChild(createButton('삭제', 'danger-button', () => deleteAdminComment(comment)));
        } else {
            actions.appendChild(createButton('복구', 'secondary-button', () => restoreComment(comment)));
        }

        item.append(heading, meta, content, actions);
        adminCommentsList.appendChild(item);
    });
}

async function editComment(comment) {
    if (!requireAdmin()) return;
    const author = prompt('댓글 작성자', comment.author || '');
    if (author === null) return;
    const content = prompt('댓글 내용', comment.content || '');
    if (content === null) return;
    if (!author.trim() || !content.trim()) {
        alert('작성자와 내용을 입력해주세요.');
        return;
    }

    const email = prompt('이메일 (선택)', comment.email || '');
    if (email === null) return;
    const homepage = prompt('홈페이지 (선택)', comment.homepage || '');
    if (homepage === null) return;

    try {
        await db.collection('blog_comments').doc(comment.id).update({
            author: author.trim(),
            content: content.trim(),
            email: email.trim(),
            homepage: homepage.trim()
        });
        await loadComments();
    } catch (error) {
        console.error('Error editing comment:', error);
        alert('댓글 수정에 실패했습니다.');
    }
}

async function deleteAdminComment(comment) {
    if (!requireAdmin()) return;
    if (!confirm('이 댓글을 삭제하시겠습니까?')) return;

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
                batch.update(parentRef, {
                    is_deleted: true,
                    updated_at: firebase.firestore.FieldValue.serverTimestamp()
                });
            }
        }

        await batch.commit();
        await loadPosts();
        await loadComments();
    } catch (error) {
        console.error('Error deleting admin comment:', error);
        alert('댓글 삭제에 실패했습니다.');
    }
}

async function restoreComment(comment) {
    if (!requireAdmin()) return;
    if (!confirm('이 댓글을 복구하시겠습니까?')) return;

    try {
        const commentRef = db.collection('blog_comments').doc(comment.id);
        const parentRef = db.collection('blog_posts').doc(comment.post_id);
        const parentDoc = await parentRef.get();
        const batch = db.batch();
        batch.update(commentRef, { is_deleted: false });
        if (parentDoc.exists && parentDoc.data().content_deleted && parentDoc.data().is_deleted) {
            batch.update(parentRef, {
                is_deleted: false,
                updated_at: firebase.firestore.FieldValue.serverTimestamp()
            });
        }
        await batch.commit();
        await loadPosts();
        await loadComments();
    } catch (error) {
        console.error('Error restoring comment:', error);
        alert('댓글 복구에 실패했습니다.');
    }
}

signInButton.addEventListener('click', async () => {
    const provider = new firebase.auth.GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    try {
        await auth.signInWithPopup(provider);
    } catch (error) {
        console.error('Google sign-in failed:', error);
        authStatus.textContent = 'Google 로그인에 실패했습니다.';
    }
});

signOutButton.addEventListener('click', () => auth.signOut());
cancelPostEditButton.addEventListener('click', resetPostForm);
cancelCategoryEditButton.addEventListener('click', resetCategoryForm);
document.getElementById('refresh-posts').addEventListener('click', loadPosts);
document.getElementById('refresh-comments').addEventListener('click', loadComments);

auth.onAuthStateChanged(async (user) => {
    adminUser = user;
    dashboard.classList.add('hidden');

    if (!user) {
        authStatus.textContent = '관리자 로그인이 필요합니다.';
        signInButton.classList.remove('hidden');
        signOutButton.classList.add('hidden');
        return;
    }

    signInButton.classList.add('hidden');
    signOutButton.classList.remove('hidden');

    if (!isAdminUser(user)) {
        authStatus.textContent = `접근이 차단되었습니다. 이 계정의 UID: ${user.uid}`;
        return;
    }

    authStatus.textContent = `${user.displayName || OWNER_NAME} 계정으로 로그인했습니다.`;
    dashboard.classList.remove('hidden');
    await loadDashboard();
});
