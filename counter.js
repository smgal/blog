document.addEventListener('DOMContentLoaded', () => {
    // Firebase 초기화 확인
    if (typeof firebase === 'undefined' || typeof firebaseConfig === 'undefined') {
        console.error('Firebase or firebaseConfig is not loaded');
        return;
    }

    // Initialize Firebase
    firebase.initializeApp(firebaseConfig);

    const db = firebase.firestore();
    const counterRef = db.collection('counters').doc('visits');
    const counterSpan = document.getElementById('visit-counter');

    const incrementCounter = async () => {
        try {
            const newCount = await db.runTransaction(async (transaction) => {
                const doc = await transaction.get(counterRef);
                let count = 1;
                if (doc.exists) {
                    count = doc.data().count + 1;
                }
                transaction.set(counterRef, { count: count });
                return count;
            });
            
            // 오늘 날짜를 YYYY/M/D 형식으로 가져옵니다.
            const today = new Date();
            const year = today.getFullYear();
            const month = today.getMonth() + 1;
            const day = today.getDate();
            const dateString = `${year}/${month}/${day}`;

            if (counterSpan) {
                counterSpan.textContent = `${dateString}까지 ${newCount.toLocaleString()}회 방문`;
            }

        } catch (error) {
            console.error("Error updating counter: ", error);
            if (counterSpan) {
                counterSpan.textContent = '카운터 로딩 실패';
            }
        }
    };

    incrementCounter();
});
