// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

const postsContainer = document.getElementById('posts-container');
const postAuthorInput = document.getElementById('post-author');
const postEmailInput = document.getElementById('post-email');
const postHomepageInput = document.getElementById('post-homepage');
const postTitleInput = document.getElementById('post-title');
const postContentInput = document.getElementById('post-content');
const submitPostButton = document.getElementById('submit-post');

// Create a post
submitPostButton.addEventListener('click', () => {
    const author = postAuthorInput.value.trim();
    const email = postEmailInput.value.trim();
    const homepage = postHomepageInput.value.trim();
    const title = postTitleInput.value.trim();
    const content = postContentInput.value.trim();

    if (author && content) {
        const counterRef = db.collection('counters').doc('main_posts');

        db.runTransaction(transaction => {
            return transaction.get(counterRef).then(doc => {
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
                    timestamp: firebase.firestore.FieldValue.serverTimestamp(),
                    post_number: newPostNumber,
                    is_comment: false,
                    parent_id: null,
                    comment_count: 0
                });
            });
        })
        .then(() => {
            postAuthorInput.value = '';
            postEmailInput.value = '';
            postHomepageInput.value = '';
            postTitleInput.value = '';
            postContentInput.value = '';
        })
        .catch((error) => {
            console.error("Error adding document: ", error);
        });
    }
});

// Render posts
const renderPosts = (snapshot) => {
    postsContainer.innerHTML = '';
    const posts = [];
    snapshot.forEach(doc => {
        posts.push({ id: doc.id, ...doc.data() });
    });

    posts.forEach((post, index) => {
        const postElement = document.createElement('div');
        postElement.classList.add('post');

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

        const replyButton = document.createElement('button');
        replyButton.classList.add('reply-button');
        replyButton.textContent = 'REPLY';
        replyButton.onclick = () => {
            window.location.href = `reply.html?id=${post.id}`;
        };

        headerElement.appendChild(metaLeftElement);
        headerElement.appendChild(replyButton);

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
        contentElement.textContent = post.content;

        postElement.appendChild(headerElement);
        postElement.appendChild(titleBarElement);
        postElement.appendChild(contentElement);

        // Comments Count
        if (post.comment_count > 0) {
            const commentsCountElement = document.createElement('div');
            commentsCountElement.classList.add('comments-count');
            commentsCountElement.textContent = `( ${post.comment_count} )`;
            metaLeftElement.appendChild(commentsCountElement);
        }

        postsContainer.appendChild(postElement);

        if (post.comment_count > 0) {
            loadAndRenderComments(post.id, postElement, post.post_number);
        }
    });
};

const loadAndRenderComments = (parentId, parentElement, parentPostNumber) => {
    const commentsRef = db.collection('posts')
        .where('parent_id', '==', parentId)
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

    headerElement.appendChild(metaLeftElement);
    headerElement.appendChild(timestampElement);
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

// Listen for real-time updates
db.collection('posts')
  .where('is_comment', '==', false)
  .orderBy('post_number', 'desc')
  .onSnapshot(renderPosts);
