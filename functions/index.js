const {onCall, HttpsError} = require("firebase-functions/v2/https");
const logger = require("firebase-functions/logger");
const admin = require("firebase-admin");

admin.initializeApp();

const db = admin.firestore();

// A helper function to extract search keywords from a referrer URL.
const getSearchKeyword = (referrer) => {
  try {
    const url = new URL(referrer);
    const hostname = url.hostname;
    
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
    return null;
  }
};

exports.recordVisit = onCall(async (request) => {
  const referrer = request.data.referrer || null;
  
  // --- LOGGING FOR DEBUGGING ---
  const debugData = { referrer };
  if (referrer) {
      try {
          const referrerUrl = new URL(referrer);
          debugData.hostname = referrerUrl.hostname.replace(/^www\./, "");
          const keyword = getSearchKeyword(referrer);
          if (keyword) {
              debugData.keyword = keyword;
              debugData.sanitizedKeyword = keyword.toLowerCase().replace(/\//g, '_').trim();
          }
      } catch (e) {
          debugData.parseError = e.message;
      }
  }
  logger.info("Debug Visit Data", debugData);
  // --- END LOGGING ---

  try {
    await db.runTransaction(async (transaction) => {
      // --- 1. DEFINE ALL DOCUMENT REFERENCES ---
      const totalVisitsRef = db.collection("counters").doc("visits");
      
      const today = new Date();
      const yyyy = today.getFullYear();
      const mm = String(today.getMonth() + 1).padStart(2, "0");
      const dd = String(today.getDate()).padStart(2, "0");
      const dateString = `${yyyy}-${mm}-${dd}`;
      const dailyStatsRef = db.collection("daily_stats").doc(dateString);

      let referrerRef = null;
      let keywordRef = null;
      let originalKeyword = null;

      if (referrer) {
        try {
          const referrerUrl = new URL(referrer);
          const hostname = referrerUrl.hostname.replace(/^www\./, "");
          const origin = request.rawRequest.headers.origin;

          if (origin && origin.startsWith("http")) {
            const originHostname = new URL(origin).hostname;
            if (hostname && hostname !== originHostname) {
              referrerRef = db.collection("referrers").doc(hostname);
            }
          } else if (hostname) {
            // Fallback for cases where origin is not available or invalid
            referrerRef = db.collection("referrers").doc(hostname);
          }
        } catch (e) {
          logger.warn("Could not parse referrer", {referrer, error: e.message});
        }

        const keyword = getSearchKeyword(referrer);
        if (keyword) {
          const sanitizedKeyword = keyword.toLowerCase().replace(/\//g, '_').trim();
          if (sanitizedKeyword) {
            keywordRef = db.collection("search_keywords").doc(sanitizedKeyword);
            originalKeyword = keyword.toLowerCase();
          }
        }
      }

      // --- 2. EXECUTE ALL READS DYNAMICALLY ---
      const reads = [
        transaction.get(totalVisitsRef),
        transaction.get(dailyStatsRef)
      ];
      if (referrerRef) reads.push(transaction.get(referrerRef));
      if (keywordRef) reads.push(transaction.get(keywordRef));
      
      const results = await Promise.all(reads);

      const totalVisitsDoc = results[0];
      const dailyStatsDoc = results[1];
      
      let docIndex = 2;
      const referrerDoc = referrerRef ? results[docIndex++] : null;
      const keywordDoc = keywordRef ? results[docIndex] : null;

      // --- 3. EXECUTE ALL WRITES ---
      const newTotalVisits = (totalVisitsDoc.data()?.count || 0) + 1;
      transaction.set(totalVisitsRef, { count: newTotalVisits }, { merge: true });

      const newDailyCount = (dailyStatsDoc.data()?.count || 0) + 1;
      transaction.set(dailyStatsRef, { count: newDailyCount }, { merge: true });

      if (referrerRef && referrerDoc) {
        const newReferrerCount = (referrerDoc.data()?.count || 0) + 1;
        transaction.set(referrerRef, { count: newReferrerCount }, { merge: true });
      }

      if (keywordRef && keywordDoc) {
        const newKeywordCount = (keywordDoc.data()?.count || 0) + 1;
        transaction.set(keywordRef, { count: newKeywordCount, original: originalKeyword }, { merge: true });
      }
    });

    return { success: true };
  } catch (error) {
    logger.error("Transaction failed for recordVisit", {
      errorMessage: error.message,
      errorStack: error.stack,
      referrer: referrer,
    });
    throw new HttpsError("internal", "Failed to record visit.");
  }
});
