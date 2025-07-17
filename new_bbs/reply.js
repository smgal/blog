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
const replyForm = document.getElementById('reply-form');

let parentPostId = null;
let parentPostNumber = null;

// Get post ID from URL
document.addEventListener('DOMContentLoaded', () => {
    const urlParams = new URLSearchParams(window.location.search);
    parentPostId = urlParams.get('id');

    if (parentPostId) {
        loadPostAndComments(parentPostId);
    } else {
        postsContainer.innerHTML = '<p>게시물을 찾을 수 없습니다.</p>';
    }
});

const loadPostAndComments = async (postId) => {
    // Load parent post
    const postRef = db.collection('posts').doc(postId);
    const postDoc = await postRef.get();

    if (!postDoc.exists || postDoc.data().is_deleted) {
        postsContainer.innerHTML = '<p>게시물을 찾을 수 없거나 삭제되었습니다.</p>';
        return;
    }

    const post = { id: postDoc.id, ...postDoc.data() };
    parentPostNumber = post.post_number;
    renderPost(post, false); // isComment = false

    // Load comments
    const commentsRef = db.collection('posts')
        .where('parent_id', '==', postId)
        .where('is_deleted', '==', false)
        .orderBy('timestamp', 'asc');
    
    commentsRef.onSnapshot(snapshot => {
        // Clear only comments, not the main post
        const existingComments = postsContainer.querySelectorAll('.comment');
        existingComments.forEach(c => c.remove());

        let commentIndex = 1;
        snapshot.forEach(doc => {
            const comment = { id: doc.id, ...doc.data() };
            renderPost(comment, true, commentIndex);
            commentIndex++;
        });
    });
};

const renderPost = (post, isComment, commentIndex) => {
    const postElement = document.createElement('div');
    postElement.classList.add('post');
    if (isComment) {
        postElement.classList.add('comment');
    }

    // Header Row
    const headerElement = document.createElement('div');
    headerElement.classList.add('post-header');

    const metaLeftElement = document.createElement('div');
    metaLeftElement.classList.add('post-meta-left');

    const postNumberElement = document.createElement('span');
    postNumberElement.classList.add('post-number');
    if (isComment) {
        postNumberElement.textContent = `#${parentPostNumber}-${post.post_number}`;
    } else {
        postNumberElement.textContent = `#${post.post_number}`;
    }

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

    headerElement.appendChild(metaLeftElement);

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

    if (isComment) {
        // 댓글 렌더링 로직 (script.js의 renderComment와 동일하게)
        headerElement.appendChild(timestampElement);
        postElement.appendChild(headerElement);

        // --- Content Wrapper for white background ---
        const contentWrapper = document.createElement('div');
        contentWrapper.classList.add('comment-content-wrapper');

        // Title Bar Row
        if (post.title) {
            titleBarElement.appendChild(titleElement);
            contentWrapper.appendChild(titleBarElement);
        }

        // Content
        const contentElement = document.createElement('div');
        contentElement.classList.add('post-content');
        contentElement.textContent = post.content;
        contentWrapper.appendChild(contentElement);

        postElement.appendChild(contentWrapper);
    } else {
        // 원본 게시물 렌더링 로직 (기존 유지)
        titleBarElement.appendChild(titleElement);
        titleBarElement.appendChild(timestampElement);

        const metaRightElement = document.createElement('div');
        metaRightElement.classList.add('post-meta-right');

        if (post.password) {
            const deleteButton = document.createElement('button');
            deleteButton.classList.add('delete-button');
            deleteButton.textContent = 'DELETE';
            deleteButton.onclick = () => deletePost(post.id, false, null);
            metaRightElement.appendChild(deleteButton);
        }

        const replyButton = document.createElement('button');
        replyButton.classList.add('reply-button');
        replyButton.textContent = 'REPLY';
        replyButton.disabled = true; // No reply on reply page
        metaRightElement.appendChild(replyButton);

        headerElement.appendChild(metaRightElement);

        const contentElement = document.createElement('div');
        contentElement.classList.add('post-content');
        contentElement.textContent = post.content;

        postElement.appendChild(headerElement);
        postElement.appendChild(titleBarElement);
        postElement.appendChild(contentElement);
    }

    postsContainer.appendChild(postElement);
};

// Create a comment
replyForm.addEventListener('submit', async (e) => {
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

    if (!parentPostId) {
        alert('답글을 달 원본 게시물을 찾을 수 없습니다.');
        return;
    }

    if (!password) {
        const confirmation = confirm('비밀번호를 설정하지 않으면 이 답글을 삭제할 수 없습니다. 이대로 등록하시겠습니까?');
        if (!confirmation) {
            return;
        }
    }

    const hashedPassword = await hashPassword(password);
    const parentRef = db.collection('posts').doc(parentPostId);

    try {
        await db.runTransaction(async (transaction) => {
            const doc = await transaction.get(parentRef);
            if (!doc.exists) {
                throw "Parent document does not exist!";
            }

            const newCommentCount = (doc.data().comment_count || 0) + 1;
            transaction.update(parentRef, { comment_count: newCommentCount });

            const newCommentRef = db.collection('posts').doc();
            transaction.set(newCommentRef, {
                author: author,
                email: email,
                homepage: homepage,
                title: title,
                content: content,
                password: hashedPassword,
                timestamp: firebase.firestore.FieldValue.serverTimestamp(),
                post_number: newCommentCount,
                is_comment: true,
                parent_id: parentPostId,
                comment_count: 0,
                is_deleted: false
            });
        });
        // Go back to the main page, to the correct page of the parent post
        // This is complex, so for now, just go to the main index.
        window.location.href = `index.html`;
    } catch (error) {
        console.error("Error adding comment: ", error);
        alert('답글 작성에 실패했습니다.');
    }
});

// This function is duplicated from script.js. In a real app, this would be in a shared utility file.
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

        const batch = db.batch();

        // Mark the post/comment itself as deleted
        batch.update(postRef, { is_deleted: true });

        // If it's a main post, mark all its comments as deleted
        if (!isComment) {
            const commentsQuery = db.collection('posts').where('parent_id', '==', postId);
            const commentsSnapshot = await commentsQuery.get();
            commentsSnapshot.forEach(commentDoc => {
                batch.update(commentDoc.ref, { is_deleted: true });
            });
        }

        await batch.commit();
        
        alert('삭제되었습니다.');
        
        if (!isComment) {
            window.location.href = 'index.html'; // Go back to home after deleting main post
        } else {
            window.location.reload();
        }

    } catch (error) {
        console.error("Error deleting post: ", error);
        alert('삭제 중 오류가 발생했습니다.');
    }
};
