const apiKey = "AIzaSyAzGaH7zcvHs83FderUFNaaqJ8gFiWcC4o";
const defaultSettings = {
  distance: 0.5,       // Default search radius in miles
  price: "2,3",        // Google Places API uses 1-4 ($ - $$$$)
  dietary: "",         // Empty means no filter (future: vegetarian, gluten-free, etc.)
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

async function fetchRestaurants() {
    try {
      document.getElementById("loading-gif").style.display = "block";
      document.getElementById("wheel").style.display = "none";
  
      navigator.geolocation.getCurrentPosition(async (position) => {
        const { latitude: lat, longitude: lng } = position.coords;
        console.log("Debug - Location:", { lat, lng }); // Debug log
        
        const settings = await loadSettings();
        console.log("Debug - Settings:", settings); // Debug log
        
        const url = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${lat},${lng}&radius=${milesToMeters(settings.distance)}&type=restaurant&key=${apiKey}`;
        
        // Use background script to fetch data
        chrome.runtime.sendMessage(
          { type: 'fetchRestaurants', url: url },
          async (response) => {
            if (response.success) {
              const data = response.data;
              console.log("Debug - API Response:", data); // Debug log

              if (!data.results || data.results.length === 0) {
                console.log("No restaurants found - API response:", data);
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
                googleMapsLink: `https://www.google.com/maps/place/?q=place_id:${place.place_id}`, // Add Google Maps link
              }));

              // ✅ Remove duplicate restaurant names
              const seen = new Set();
              restaurants = restaurants.filter((restaurant) => {
                if (seen.has(restaurant.name)) {
                  return false; // Duplicate found, skip this restaurant
                }
                seen.add(restaurant.name);
                return true; // Unique restaurant, keep it
              });

              console.log("✅ Unique Restaurants fetched:", restaurants);

              // ✅ Store restaurant details globally
              restaurantDetails = restaurants.reduce((acc, r) => {
                acc[r.name] = r;
                return acc;
              }, {});

              // Add this right after getting the position
              console.log("Settings:", settings);
              console.log("URL:", url);
              console.log("Response:", data);

              // ⏳ Wait 5 seconds before showing the wheel
              setTimeout(() => {
                document.getElementById("loading-gif").style.display = "none"; // ✅ Hide Loading GIF
                document.getElementById("wheel").style.display = "block"; // ✅ Show the wheel
                updateWheel(restaurants); // ✅ Update the wheel with restaurant names
              }, 2000);
            } else {
              console.error("API Error:", response.error);
              alert("Error fetching restaurants. Please try again.");
            }
          }
        );
      }, (error) => {
        console.error("Geolocation error:", error);
        alert("Please enable location access to fetch restaurants.");
      });
    } catch (error) {
      console.error("Error in fetchRestaurants:", error);
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

// Update: Add History Feature Implementation

// Global state for restaurant history
let restaurantHistory = [];

/**
 * Adds a restaurant to the history list
 * @param {Object} restaurant - Restaurant object containing name and maps link
 */
function addToHistory(restaurant) {
    // Create history entry with current timestamp
    const historyEntry = {
        name: restaurant.name,
        timestamp: new Date().toLocaleString(),
        googleMapsLink: restaurant.googleMapsLink
    };
    
    // Add to beginning of array (most recent first)
    restaurantHistory.unshift(historyEntry);
    
    // Maintain only last 10 entries for performance
    if (restaurantHistory.length > 10) {
        restaurantHistory.pop();
    }
    
    // Persist to Chrome storage
    chrome.storage.sync.set({ 'restaurantHistory': restaurantHistory }, () => {
        console.log('History saved successfully');
        updateHistoryDisplay();
    });
}

/**
 * Updates the UI to display the current history
 */
function updateHistoryDisplay() {
    const historyList = document.getElementById('history-list');
    if (!historyList) return;
    
    // Clear existing entries
    historyList.innerHTML = '';
    
    // Add each history entry to the UI
    restaurantHistory.forEach((entry) => {
        const li = document.createElement('li');
        
        // Create clickable restaurant name
        const nameLink = document.createElement('a');
        nameLink.href = entry.googleMapsLink;
        nameLink.target = '_blank';
        nameLink.textContent = entry.name;
        
        // Create timestamp display
        const timestamp = document.createElement('span');
        timestamp.className = 'timestamp';
        timestamp.textContent = entry.timestamp;
        
        // Assemble and add to list
        li.appendChild(nameLink);
        li.appendChild(timestamp);
        historyList.appendChild(li);
    });
    
    // Toggle history section visibility
    const historyLog = document.getElementById('history-log');
    if (historyLog) {
        historyLog.style.display = restaurantHistory.length > 0 ? 'block' : 'none';
    }
}

// ====================================================================


// 🛠️ Toggle Settings View
function showSettings() {
  document.getElementById("main-view").style.display = "none";
  document.getElementById("settings-view").style.display = "block";
}

function hideSettings() {
  document.getElementById("main-view").style.display = "block";
  document.getElementById("settings-view").style.display = "none";
}

// =================== Integrating History Feature  ===================

// Ensure scripts run only after DOM is loaded
document.addEventListener("DOMContentLoaded", async () => {
  await fetchRestaurants();

  // Load saved history from Chrome storage
  chrome.storage.sync.get(['restaurantHistory'], (result) => {
    restaurantHistory = result.restaurantHistory || [];
    updateHistoryDisplay();
  });

  // Update spin button to record history
  document.getElementById('spin').addEventListener('click', async () => {
    await spin();
    const selectedRestaurant = document.getElementById('selected-restaurant').textContent;
    if (selectedRestaurant && restaurantDetails[selectedRestaurant]) {
      addToHistory(restaurantDetails[selectedRestaurant]);
    }
  });

  // ====================================================================

  // Open settings view
  document.getElementById("open-settings").addEventListener("click", showSettings);

  // Close settings view
  document.getElementById("close-settings").addEventListener("click", hideSettings);

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
      hideSettings();
      await fetchRestaurants(); // Fetch restaurants with the new settings
    });
  });
});