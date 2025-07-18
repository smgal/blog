// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

const postsContainer = document.getElementById('posts-container');
const postAuthorInput = document.getElementById('post-author');
const postPasswordInput = document.getElementById('post-password');
const postEmailInput = document.getElementById('post-email');
const postHomepageInput = document.getElementById('post-homepage');
const postTitleInput = document.getElementById('post-title');
const postContentInput = document.getElementById('post-content');
const postForm = document.getElementById('post-form');
const paginationTop = document.getElementById('pagination-top');
const paginationBottom = document.getElementById('pagination-bottom');

// --- Pagination State ---
let currentPage = 1;
let totalPosts = 0;
let totalPages = 1;
const postsPerPage = boardConfig.postsPerPage || 10;

// Create a post
postForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const author = postAuthorInput.value.trim();
    const password = postPasswordInput.value.trim();
    const email = postEmailInput.value.trim();
    const homepage = postHomepageInput.value.trim();
    const title = postTitleInput.value.trim();
    const content = postContentInput.value.trim();

    if (!author || !content) {
        alert('이름과 내용을 모두 입력해주세요.');
        return;
    }

    if (!password) {
        const confirmation = confirm('비밀번호를 설정하지 않으면 글을 삭제할 수 없습니다. 이대로 등록하시겠습니까?');
        if (!confirmation) {
            return;
        }
    }

    const hashedPassword = await hashPassword(password);

    try {
        const counterRef = db.collection('counters').doc('main_posts');
        await db.runTransaction(async (transaction) => {
            const doc = await transaction.get(counterRef);
            let newPostNumber = 1;
            if (doc.exists) {
                newPostNumber = doc.data().count + 1;
            }
            transaction.set(counterRef, { count: newPostNumber });

            const newPostRef = db.collection('posts').doc();
            transaction.set(newPostRef, {
                author: author,
                email: email,
                homepage: homepage,
                title: title,
                content: content,
                password: hashedPassword,
                timestamp: firebase.firestore.FieldValue.serverTimestamp(),
                post_number: newPostNumber,
                is_comment: false,
                parent_id: null,
                comment_count: 0,
                is_deleted: false
            });
        });
        window.location.href = 'index.html?page=1';
    } catch (error) {
        console.error("Error adding document: ", error);
        alert('글 작성에 실패했습니다.');
    }
});

// Render posts
const renderPosts = (snapshot) => {
    if (snapshot.empty) {
        postsContainer.innerHTML = '<p>표시할 게시물이 없습니다.</p>';
        return;
    }

    postsContainer.innerHTML = '';
    const posts = [];
    snapshot.forEach(doc => {
        posts.push({ id: doc.id, ...doc.data() });
    });

    posts.forEach((post, index) => {
        const postElement = document.createElement('div');
        postElement.classList.add('post');
        if (post.content_deleted) {
            postElement.classList.add('content-deleted');
        }

        // Header Row
        const headerElement = document.createElement('div');
        headerElement.classList.add('post-header');

        const metaLeftElement = document.createElement('div');
        metaLeftElement.classList.add('post-meta-left');

        const postNumberElement = document.createElement('span');
        postNumberElement.classList.add('post-number');
        postNumberElement.textContent = `#${post.post_number}`;

        const authorElement = document.createElement('span');
        authorElement.classList.add('author');
        if (post.email) {
            const authorLink = document.createElement('a');
            authorLink.href = `mailto:${post.email}`;
            authorLink.textContent = post.author;
            authorElement.appendChild(authorLink);
        } else {
            authorElement.textContent = post.author;
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

        if (post.password && !post.content_deleted) {
            const deleteButton = document.createElement('button');
            deleteButton.classList.add('delete-button');
            deleteButton.textContent = 'DELETE';
            deleteButton.onclick = () => deletePost(post.id, post.is_comment, post.parent_id);
            metaRightElement.appendChild(deleteButton);
        }

        if (!post.content_deleted) {
            const replyButton = document.createElement('button');
            replyButton.classList.add('reply-button');
            replyButton.textContent = 'REPLY';
            replyButton.onclick = () => {
                window.location.href = `reply.html?id=${post.id}`;
            };
            metaRightElement.appendChild(replyButton);
        }

        headerElement.appendChild(metaLeftElement);
        headerElement.appendChild(metaRightElement);

        // Title Bar Row
        const titleBarElement = document.createElement('div');
        titleBarElement.classList.add('post-title-bar');

        const titleElement = document.createElement('span');
        titleElement.textContent = post.title;

        const timestampElement = document.createElement('span');
        timestampElement.classList.add('post-timestamp');
        if (post.timestamp && post.timestamp.seconds) {
            const date = new Date(post.timestamp.seconds * 1000);
            const days = ['일', '월', '화', '수', '목', '금', '토'];
            const dayName = days[date.getDay()];
            const dateString = `${date.getFullYear()}/${String(date.getMonth() + 1).padStart(2, '0')}/${String(date.getDate()).padStart(2, '0')} (${dayName})`;
            
            let hours = date.getHours();
            const minutes = String(date.getMinutes()).padStart(2, '0');
            const ampm = hours >= 12 ? 'PM' : 'AM';
            hours = hours % 12;
            hours = hours ? hours : 12; // 0시는 12시로 표시
            const timeString = `${ampm} ${String(hours).padStart(2, '0')}:${minutes}`;

            const dateSpan = document.createElement('span');
            dateSpan.classList.add('date');
            dateSpan.textContent = dateString;

            const timeSpan = document.createElement('span');
            timeSpan.classList.add('time');
            timeSpan.textContent = timeString;

            timestampElement.appendChild(dateSpan);
            timestampElement.appendChild(timeSpan);
        } else {
            timestampElement.textContent = '방금 전';
        }

        titleBarElement.appendChild(titleElement);
        titleBarElement.appendChild(timestampElement);

        // Content
        const contentElement = document.createElement('div');
        contentElement.classList.add('post-content');
        contentElement.textContent = post.content_deleted ? '삭제된 글입니다.' : post.content;

        postElement.appendChild(headerElement);
        postElement.appendChild(titleBarElement);
        postElement.appendChild(contentElement);

        postsContainer.appendChild(postElement);

        if (post.comment_count > 0) {
            loadAndRenderComments(post.id, postElement, post.post_number);
        }
    });
};

const loadAndRenderComments = (parentId, parentElement, parentPostNumber) => {
    const commentsRef = db.collection('posts')
        .where('parent_id', '==', parentId)
        .where('is_deleted', '==', false)
        .orderBy('timestamp', 'asc');

    commentsRef.get().then(snapshot => {
        snapshot.forEach(doc => {
            const comment = { id: doc.id, ...doc.data() };
            renderComment(comment, parentElement, parentPostNumber);
        });
    });
};

const renderComment = (comment, parentElement, parentPostNumber) => {
    const commentElement = document.createElement('div');
    commentElement.classList.add('post', 'comment');

    // Header Row
    const headerElement = document.createElement('div');
    headerElement.classList.add('post-header');

    const metaLeftElement = document.createElement('div');
    metaLeftElement.classList.add('post-meta-left');

    const postNumberElement = document.createElement('span');
    postNumberElement.classList.add('post-number');
    postNumberElement.textContent = `#${parentPostNumber}-${comment.post_number}`;

    const authorElement = document.createElement('span');
    authorElement.classList.add('author');
    if (comment.email) {
        const authorLink = document.createElement('a');
        authorLink.href = `mailto:${comment.email}`;
        authorLink.textContent = comment.author;
        authorElement.appendChild(authorLink);
    } else {
        authorElement.textContent = comment.author;
    }

    metaLeftElement.appendChild(postNumberElement);
    metaLeftElement.appendChild(authorElement);

    if (comment.homepage) {
        const homepageLink = document.createElement('a');
        let homepageUrl = comment.homepage;
        if (!homepageUrl.startsWith('http://') && !homepageUrl.startsWith('https://')) {
            homepageUrl = 'http://' + homepageUrl;
        }
        homepageLink.href = homepageUrl;
        homepageLink.textContent = `[홈페이지]`;
        homepageLink.target = '_blank';
        homepageLink.classList.add('homepage-link');
        metaLeftElement.appendChild(homepageLink);
    }
    
    const timestampElement = document.createElement('span');
    timestampElement.classList.add('post-timestamp');
    if (comment.timestamp && comment.timestamp.seconds) {
        const date = new Date(comment.timestamp.seconds * 1000);
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
    } else {
        timestampElement.textContent = '방금 전';
    }

    const metaRightElement = document.createElement('div');
    metaRightElement.classList.add('post-meta-right');

    if (comment.password) {
        const deleteButton = document.createElement('button');
        deleteButton.classList.add('delete-button');
        deleteButton.textContent = 'DELETE';
        deleteButton.onclick = () => deletePost(comment.id, true, comment.parent_id);
        metaRightElement.appendChild(deleteButton);
    }

    metaRightElement.appendChild(timestampElement);

    headerElement.appendChild(metaLeftElement);
    headerElement.appendChild(metaRightElement);
    commentElement.appendChild(headerElement);

    // --- Content Wrapper for white background ---
    const contentWrapper = document.createElement('div');
    contentWrapper.classList.add('comment-content-wrapper');

    // Title Bar Row
    if (comment.title) {
        const titleBarElement = document.createElement('div');
        titleBarElement.classList.add('post-title-bar');
        const titleElement = document.createElement('span');
        titleElement.textContent = comment.title;
        titleBarElement.appendChild(titleElement);
        contentWrapper.appendChild(titleBarElement);
    }

    // Content
    const contentElement = document.createElement('div');
    contentElement.classList.add('post-content');
    contentElement.textContent = comment.content;
    contentWrapper.appendChild(contentElement);

    commentElement.appendChild(contentWrapper);
    parentElement.appendChild(commentElement);
};

// --- Pagination Logic ---

const renderPagination = () => {
    if (totalPages <= 1) {
        paginationTop.innerHTML = '';
        paginationBottom.innerHTML = '';
        return;
    }

    let paginationHtml = '';
    const pageGroupSize = 10;
    const currentGroup = Math.ceil(currentPage / pageGroupSize);
    const startPage = (currentGroup - 1) * pageGroupSize + 1;
    const endPage = Math.min(startPage + pageGroupSize - 1, totalPages);

    // '<<' (First Page)
    if (currentPage > 1) {
         paginationHtml += `<a href="?page=1">«</a>`;
    } else {
         paginationHtml += `<span class="disabled">«</span>`;
    }

    // '<' (Previous Group)
    if (currentGroup > 1) {
        const prevGroupPage = (currentGroup - 2) * pageGroupSize + 1;
        paginationHtml += `<a href="?page=${prevGroupPage}">‹</a>`;
    } else {
        paginationHtml += `<span class="disabled">‹</span>`;
    }

    // Page numbers
    for (let i = startPage; i <= endPage; i++) {
        if (i === currentPage) {
            paginationHtml += `<span class="current">${i}</span>`;
        } else {
            paginationHtml += `<a href="?page=${i}">${i}</a>`;
        }
    }

    // '>' (Next Group)
    if (currentGroup < Math.ceil(totalPages / pageGroupSize)) {
        const nextGroupPage = currentGroup * pageGroupSize + 1;
        paginationHtml += `<a href="?page=${nextGroupPage}">›</a>`;
    } else {
        paginationHtml += `<span class="disabled">›</span>`;
    }

    // '>>' (Last Page)
    if (currentPage < totalPages) {
        paginationHtml += `<a href="?page=${totalPages}">»</a>`;
    } else {
        paginationHtml += `<span class="disabled">»</span>`;
    }

    paginationTop.innerHTML = paginationHtml;
    paginationBottom.innerHTML = paginationHtml;
};

const loadPage = async (page) => {
    postsContainer.innerHTML = '<p>게시물을 불러오는 중...</p>';
    
    try {
        let query = db.collection('posts')
            .where('is_comment', '==', false)
            .where('is_deleted', '==', false)
            .orderBy('post_number', 'desc');

        // For pages other than the first, we need to find the last document of the previous page
        if (page > 1) {
            const offset = (page - 1) * postsPerPage;
            const cursorQuery = db.collection('posts')
                .where('is_comment', '==', false)
                .where('is_deleted', '==', false)
                .orderBy('post_number', 'desc')
                .limit(offset);
            
            const cursorSnapshot = await cursorQuery.get();
            if (!cursorSnapshot.empty) {
                const lastVisible = cursorSnapshot.docs[cursorSnapshot.docs.length - 1];
                query = query.startAfter(lastVisible);
            }
        }
        
        query = query.limit(postsPerPage);

        const snapshot = await query.get();
        renderPosts(snapshot);

    } catch (error) {
        console.error("Error fetching posts:", error);
        postsContainer.innerHTML = '<p>게시물을 불러오는 데 실패했습니다.</p>';
    }
};

const initBoard = async () => {
    const urlParams = new URLSearchParams(window.location.search);
    currentPage = parseInt(urlParams.get('page')) || 1;

    const query = db.collection('posts')
        .where('is_comment', '==', false)
        .where('is_deleted', '==', false);
    
    try {
        // Get the total number of actual posts
        const snapshot = await query.get();
        totalPosts = snapshot.size;
        totalPages = Math.ceil(totalPosts / postsPerPage) || 1;

        if (currentPage > totalPages) currentPage = totalPages;
        if (currentPage < 1) currentPage = 1;

        renderPagination();
        loadPage(currentPage);

    } catch (error) {
        console.error("Error initializing board:", error);
        postsContainer.innerHTML = '<p>게시판을 초기화하는 데 실패했습니다.</p>';
    }
};

const deletePost = async (postId, isComment, parentId) => {
    const password = prompt('삭제하려면 비밀번호를 입력하세요.');
    if (!password) return;

    const postRef = db.collection('posts').doc(postId);

    try {
        const doc = await postRef.get();
        if (!doc.exists) {
            alert('삭제할 게시물을 찾을 수 없습니다.');
            return;
        }

        const postData = doc.data();
        
        if (!postData.password) {
            alert('이 게시물에는 비밀번호가 설정되어 있지 않아 삭제할 수 없습니다.');
            return;
        }

        const hashedPassword = await hashPassword(password);

        if (hashedPassword !== postData.password) {
            alert('비밀번호가 일치하지 않습니다.');
            return;
        }

        const confirmation = confirm('정말로 이 게시물을 삭제하시겠습니까?');
        if (!confirmation) return;

        // Check for active (not deleted) comments
        const commentsQuery = db.collection('posts')
            .where('parent_id', '==', (isComment ? parentId : postId))
            .where('is_deleted', '==', false);
        
        const commentsSnapshot = await commentsQuery.get();
        
        let activeCommentsExist = false;
        if (isComment) {
            // If deleting a comment, check if other non-deleted comments exist
            commentsSnapshot.forEach(commentDoc => {
                if (commentDoc.id !== postId) {
                    activeCommentsExist = true;
                }
            });
        } else {
            // If deleting a post, check if any non-deleted comments exist
            activeCommentsExist = !commentsSnapshot.empty;
        }

        const batch = db.batch();

        if (activeCommentsExist && !isComment) {
            // Case: Deleting a post with active comments -> content delete
            batch.update(postRef, { 
                content_deleted: true,
                title: '(삭제됨)',
                content: '삭제된 글입니다.'
            });
        } else {
            // Case: Deleting a comment, or a post with no active comments -> full delete
            batch.update(postRef, { is_deleted: true });

            // If deleting the last active comment, check if the parent post is content_deleted.
            // If so, delete the parent post as well.
            if (isComment && !activeCommentsExist && parentId) {
                const parentRef = db.collection('posts').doc(parentId);
                const parentDoc = await parentRef.get();
                if (parentDoc.exists && parentDoc.data().content_deleted) {
                    batch.update(parentRef, { is_deleted: true });
                }
            }
        }

        await batch.commit();
        
        window.location.reload();

    } catch (error) {
        console.error("Error deleting post: ", error);
        alert('게시물 삭제 중 오류가 발생했습니다.');
    }
};

document.addEventListener('DOMContentLoaded', initBoard);
