// Listen for messages from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'fetchRestaurants') {
    fetch(request.url)
      .then(response => response.json())
      .then(data => sendResponse({ success: true, data: data }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true; // Will respond asynchronously
  }
});

// Set up daily reminder (moved after the message listener)
chrome.alarms.create("dailyReminder", { 
  when: Date.now(),
  periodInMinutes: 1440 // 24 hours
});

// Listen for alarm
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === "dailyReminder") {
    chrome.notifications.create("lunchTime", {
      type: "basic",
      iconUrl: "assets/icon.png",
      title: "Lunch Lotto",
      message: "It's time for lunch! Open the Lunch Lotto extension to find your meal."
    });
  }
});
