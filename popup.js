// Add your Google Places API key here
const apiKey = "YOUR_API_KEY";  // Replace with your actual API key from Google Cloud Console
const defaultSettings = {
  distance: 0.5,       // Default search radius in miles
  price: "2,3",        // Google Places API uses 1-4 ($ - $$$$)
  dietary: "",         // Empty means no filter (future: vegetarian, gluten-free, etc.)
  history: [],         // Update:Store history of selected restaurants
};
// Convert miles to meters (Google Maps API uses meters)
function milesToMeters(miles) {
  return miles * 1609.34;
}

// Load user settings or use defaults
async function loadSettings() {
  return new Promise((resolve) => {
    chrome.storage.sync.get(defaultSettings, (settings) => {
      resolve(settings);
    });
  });
}

// Helper function to update progress
function updateProgress(percent, text) {
    const progressBar = document.getElementById("progress-bar");
    const progressText = document.getElementById("progress-text");
    progressBar.style.width = `${percent}%`;
    if (text) progressText.textContent = text;
}

async function fetchRestaurants() {
    try {
        // 🔄 Show Loading Container and Hide the Wheel
        document.getElementById("loading-container").style.display = "block";
        document.getElementById("wheel").style.display = "none";
        document.getElementById("spin").style.display = "none";

        // Initialize progress
        updateProgress(10, "Getting your location...");

        navigator.geolocation.getCurrentPosition(async (position) => {
            const { latitude: lat, longitude: lng } = position.coords;
            updateProgress(30, "Location found! Loading settings...");

            const settings = await loadSettings();
            updateProgress(40, "Searching for restaurants...");

            const url = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${lat},${lng}&radius=${milesToMeters(settings.distance)}&type=restaurant&keyword=healthy&minprice=${settings.price[0]}&maxprice=${settings.price[2]}&key=${apiKey}`;

            const response = await fetch(url);
            const data = await response.json();
            updateProgress(60, "Processing restaurant data...");

            if (!data.results || data.results.length === 0) {
                console.error("❌ No restaurants found!");
                alert("No restaurants found! Try adjusting your settings.");
                return;
            }

            // ✅ Extract restaurant data
            let restaurants = data.results.map((place) => ({
                name: place.name,
                distance: (settings.distance).toFixed(1),
                price: place.price_level ? "$".repeat(place.price_level) : "Unknown",
                lat: place.geometry.location.lat,
                lng: place.geometry.location.lng,
                placeId: place.place_id,
                googleMapsLink: `https://www.google.com/maps/place/?q=place_id:${place.place_id}`,
            }));

            updateProgress(80, "Removing duplicates...");

            // ✅ Remove duplicate restaurant names
            const seen = new Set();
            restaurants = restaurants.filter((restaurant) => {
                if (seen.has(restaurant.name)) {
                    return false;
                }
                seen.add(restaurant.name);
                return true;
            });

            console.log("✅ Unique Restaurants fetched:", restaurants);

            // ✅ Store restaurant details globally
            restaurantDetails = restaurants.reduce((acc, r) => {
                acc[r.name] = r;
                return acc;
            }, {});

            updateProgress(90, "Preparing the wheel...");

            // ⏳ Wait before showing the wheel
            setTimeout(() => {
                updateProgress(100, "Ready!");
                setTimeout(() => {
                    document.getElementById("loading-container").style.display = "none";
                    document.getElementById("wheel").style.display = "block";
                    document.getElementById("spin").style.display = "block";
                    updateWheel(restaurants);
                }, 500); // Short delay after reaching 100%
            }, 1000);

        }, (error) => {
            console.error("❌ Geolocation error:", error);
            alert("Please enable location access to fetch restaurants.");
            document.getElementById("loading-container").style.display = "none";
            document.getElementById("wheel").style.display = "block";
            document.getElementById("spin").style.display = "block";
        });
    } catch (error) {
        console.error("❌ Error fetching restaurants:", error);
        document.getElementById("loading-container").style.display = "none";
        document.getElementById("wheel").style.display = "block";
        document.getElementById("spin").style.display = "block";
    }
}  

function updateWheel(restaurants) {
    options.length = 0; // Clear the current options array
  
    // Randomly shuffle the restaurants array
    const shuffledRestaurants = [...restaurants].sort(() => Math.random() - 0.5);
  
    // Choose 8 random restaurants
    const selectedRestaurants = shuffledRestaurants.slice(0, 8);
  
    // Extract restaurant names and Google Maps links, and populate options array
    options.push(...selectedRestaurants.map((restaurant) => ({
      name: restaurant.name,
      googleMapsLink: restaurant.googleMapsLink, // Add Google Maps link
    })));
  
    // Debugging: Log the selected restaurants with their links
    console.log("✅ Options for the Wheel:", options);
  
    // Store full restaurant details, including names and links
    restaurantDetails = selectedRestaurants.map((restaurant) => ({
      name: restaurant.name,
      googleMapsLink: restaurant.googleMapsLink // Add the Google Maps link
    }));
  
    console.log("✅ Selected Restaurants for the Wheel:", restaurantDetails);
  
    // Redraw the wheel with the updated options
    drawWheel();
  }  

// 🛠️ Toggle Views
function showSettings() {
  document.getElementById("main-view").style.display = "none";
  document.getElementById("settings-view").style.display = "block";
  document.getElementById("history-view").style.display = "none";
}

/**
 * ~Update
 * Function: Formats a date string into a readable format
 * @param {string} dateString - ISO date string
 * @returns {string} Formatted date string
 */
function formatDate(dateString) {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

/**
 * ~Update
 * Function: Displays the history entries in the history view
 */
async function displayHistory() {
  const settings = await loadSettings();
  const history = settings.history || [];
  const historyList = document.getElementById("history-list");
  
  if (history.length === 0) {
    historyList.innerHTML = '<p style="color: #666; text-align: center;">No history yet</p>';
    return;
  }

  const historyHTML = history.map(entry => `
    <div style="padding: 15px; margin: 10px 0; background: #f8f9fa; border-radius: 8px; border: 1px solid #eee;">
      <div style="font-weight: bold; margin-bottom: 5px;">${entry.name}</div>
      <div style="font-size: 12px; color: #666; margin-bottom: 8px;">${formatDate(entry.timestamp)}</div>
      <a href="${entry.googleMapsLink}" target="_blank" style="color: #007bff; font-size: 12px; text-decoration: none;">View on Google Maps</a>
    </div>
  `).join('');
  
  historyList.innerHTML = historyHTML;
}

function showHistory() {
  document.getElementById("main-view").style.display = "none";
  document.getElementById("settings-view").style.display = "none";
  // Update: Display History View
  document.getElementById("history-view").style.display = "block";
  displayHistory();
}

function showMainView() {
  document.getElementById("main-view").style.display = "block";
  document.getElementById("settings-view").style.display = "none";
  // Update 5: Hide History View
  document.getElementById("history-view").style.display = "none";
}

/**
 * ~Update
 * Function: Saves restaurants to history, when selected by the wheel.
 * @param {Object} restaurant - The selected restaurant object
 */
async function addToHistory(restaurant) {
  try {
    const settings = await loadSettings();
    const history = settings.history || [];
    
    // Add new entry with timestamp
    const entry = {
      ...restaurant,
      timestamp: new Date().toISOString()
    };
    
    // Add to beginning of array (most recent first)
    history.unshift(entry);
    
    // Keep only last 10 entries
    const updatedHistory = history.slice(0, 10);
    
    // Save back to storage
    chrome.storage.sync.set({ 
      ...settings, 
      history: updatedHistory 
    });
    
    console.log("✅ Added to history:", entry);
  } catch (error) {
    console.error("❌ Error saving to history:", error);
  }
}

// Update the DOMContentLoaded event listener
document.addEventListener("DOMContentLoaded", async () => {
  await fetchRestaurants();

  // Spin button event
  document.getElementById("spin").addEventListener("click", () => spin());

  // Update 6: Navigation events
  document.getElementById("open-settings").addEventListener("click", showSettings);
  document.getElementById("open-history").addEventListener("click", showHistory);
  document.getElementById("close-settings").addEventListener("click", showMainView);
  document.getElementById("close-history").addEventListener("click", showMainView);

  // Load saved settings into inputs
  const settings = await loadSettings();
  document.getElementById("distance").value = settings.distance;
  document.getElementById("price").value = settings.price;

  // Save settings
  document.getElementById("save-settings").addEventListener("click", async () => {
    const distance = parseFloat(document.getElementById("distance").value);
    const price = document.getElementById("price").value;
  
    // Save the updated settings
    chrome.storage.sync.set({ distance, price }, async () => {
      swal({
        title: `Settings saved!`,
        icon: "success",
        button: false, // Hide the default OK button
      });
  
      // Hide the settings view and fetch new restaurants
      showMainView();
      await fetchRestaurants(); // Fetch restaurants with the new settings
    });
  });
});
