const {onCall} = require("firebase-functions/v2/https");
const admin = require("firebase-admin");

admin.initializeApp();

const db = admin.firestore();

// A helper function to extract search keywords from a referrer URL.
const getSearchKeyword = (referrer) => {
  try {
    const url = new URL(referrer);
    const hostname = url.hostname;
    
    // List of search engines and their query parameters
    const searchEngines = {
      "google.": "q",
      "naver.com": "query",
      "bing.com": "q",
      "yahoo.com": "p",
      "daum.net": "q",
      "nate.com": "q",
    };

    for (const engine in searchEngines) {
      if (hostname.includes(engine)) {
        const queryParam = searchEngines[engine];
        return url.searchParams.get(queryParam);
      }
    }
    return null;
  } catch (error) {
    // This can happen if the referrer is not a valid URL.
    return null;
  }
};

exports.recordVisit = onCall(async (request) => {
  const referrer = request.data.referrer || null;
  
  // Use a transaction to ensure all writes are atomic.
  await db.runTransaction(async (transaction) => {
    // 1. Increment total visits
    const totalVisitsRef = db.collection("counters").doc("visits");
    const totalVisitsDoc = await transaction.get(totalVisitsRef);
    const newTotalVisits = (totalVisitsDoc.data()?.count || 0) + 1;
    transaction.set(totalVisitsRef, { count: newTotalVisits }, { merge: true });

    // 2. Increment daily stats
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, "0");
    const dd = String(today.getDate()).padStart(2, "0");
    const dateString = `${yyyy}-${mm}-${dd}`;
    
    const dailyStatsRef = db.collection("daily_stats").doc(dateString);
    const dailyStatsDoc = await transaction.get(dailyStatsRef);
    const newDailyCount = (dailyStatsDoc.data()?.count || 0) + 1;
    transaction.set(dailyStatsRef, { count: newDailyCount }, { merge: true });

    if (referrer) {
      // 3. Increment referrer stats
      try {
        const referrerUrl = new URL(referrer);
        const hostname = referrerUrl.hostname.replace(/^www\./, ""); // remove www.
        
        const origin = request.rawRequest.headers.origin;
        if (origin && hostname && hostname !== new URL(origin).hostname) {
            const referrerRef = db.collection("referrers").doc(hostname);
            const referrerDoc = await transaction.get(referrerRef);
            const newReferrerCount = (referrerDoc.data()?.count || 0) + 1;
            transaction.set(referrerRef, { count: newReferrerCount }, { merge: true });
        }
      } catch (e) {
        // Ignore invalid referrer URLs
      }

      // 4. Increment search keyword stats
      const keyword = getSearchKeyword(referrer);
      if (keyword) {
        const keywordRef = db.collection("search_keywords").doc(keyword.toLowerCase());
        const keywordDoc = await transaction.get(keywordRef);
        const newKeywordCount = (keywordDoc.data()?.count || 0) + 1;
        transaction.set(keywordRef, { count: newKeywordCount }, { merge: true });
      }
    }
  });

  return { success: true };
});
