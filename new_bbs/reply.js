// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

const postsContainer = document.getElementById('posts-container');
const postAuthorInput = document.getElementById('post-author');
const postEmailInput = document.getElementById('post-email');
const postHomepageInput = document.getElementById('post-homepage');
const postTitleInput = document.getElementById('post-title');
const postContentInput = document.getElementById('post-content');
const submitReplyButton = document.getElementById('submit-reply');

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

    if (!postDoc.exists) {
        postsContainer.innerHTML = '<p>원본 게시물을 찾을 수 없습니다.</p>';
        return;
    }

    const post = { id: postDoc.id, ...postDoc.data() };
    parentPostNumber = post.post_number;
    renderPost(post, false); // isComment = false

    // Load comments
    const commentsRef = db.collection('posts')
        .where('parent_id', '==', postId)
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

        const replyButton = document.createElement('button');
        replyButton.classList.add('reply-button');
        replyButton.textContent = 'REPLY';
        replyButton.disabled = true; // No reply on reply page
        headerElement.appendChild(replyButton);

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
submitReplyButton.addEventListener('click', () => {
    const author = postAuthorInput.value.trim();
    const email = postEmailInput.value.trim();
    const homepage = postHomepageInput.value.trim();
    const title = postTitleInput.value.trim();
    const content = postContentInput.value.trim();

    if (author && content && parentPostId) {
        const parentRef = db.collection('posts').doc(parentPostId);

        db.runTransaction(transaction => {
            return transaction.get(parentRef).then(doc => {
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
                    timestamp: firebase.firestore.FieldValue.serverTimestamp(),
                    post_number: newCommentCount, // Use the new comment count as the number
                    is_comment: true,
                    parent_id: parentPostId,
                    comment_count: 0 // Replies to comments are not supported
                });
            });
        })
        .then(() => {
            window.location.href = 'index.html';
        })
        .catch((error) => {
            console.error("Error adding comment: ", error);
            alert('답글 작성에 실패했습니다.');
        });
    }
});
