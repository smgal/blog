document.addEventListener('DOMContentLoaded', () => {
    // Firebase 초기화 확인
    if (typeof firebase === 'undefined' || typeof firebaseConfig === 'undefined') {
        console.error('Firebase or firebaseConfig is not loaded');
        return;
    }

    // Initialize Firebase
    firebase.initializeApp(firebaseConfig);
    const db = firebase.firestore();
    const functions = firebase.functions();

    const counterSpan = document.getElementById('visit-counter');

    // Function to display the counter. It now only reads the total count.
    const displayCounter = async () => {
        const counterRef = db.collection('counters').doc('visits');
        try {
            const doc = await counterRef.get();
            let count = 0;
            if (doc.exists) {
                count = doc.data().count;
            }
            
            const today = new Date();
            const year = today.getFullYear();
            const month = today.getMonth() + 1;
            const day = today.getDate();
            const dateString = `${year}/${month}/${day}`;

            if (counterSpan) {
                counterSpan.textContent = `${dateString}까지 ${count.toLocaleString()}회 방문`;
            }
        } catch (error) {
            console.error("Error reading counter:", error);
            if (counterSpan) {
                counterSpan.textContent = '카운터 로딩 실패';
            }
        }
    };

    // Call the Cloud Function to record the visit.
    const recordVisit = async () => {
        try {
            const recordVisitFunction = functions.httpsCallable('recordVisit');
            await recordVisitFunction({ referrer: document.referrer });
        } catch (error) {
            console.error('Error calling recordVisit function:', error);
        }
    };

    // --- Main Execution ---
    // 1. Call the function to record the visit in the background.
    recordVisit();
    
    // 2. Immediately display the current counter value.
    // This provides a fast UI response without waiting for the function to complete.
    displayCounter();
});
