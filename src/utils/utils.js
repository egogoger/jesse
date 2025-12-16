export function getRandomArrayItem(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
}

function chooseNextItemAfterWeekend(items, chosenIndex) {
    const chosenItem = items[chosenIndex];
    const itemTime = new Date(chosenItem.time);
    
    // Create Friday 17:00 UTC for the same week
    const friday = new Date(itemTime);
    friday.setUTCDate(itemTime.getUTCDate() + (5 - itemTime.getUTCDay())); // Move to Friday
    friday.setUTCHours(17, 0, 0, 0);
    
    // Create Sunday 14:00 UTC for the same week
    const sunday = new Date(friday);
    sunday.setUTCDate(friday.getUTCDate() + 2); // Friday + 2 days = Sunday
    sunday.setUTCHours(14, 0, 0, 0);
    
    // Check if item time is between Friday 17:00 and Sunday 14:00
    const isWeekendTime = itemTime >= friday && itemTime <= sunday;
    
    if (!isWeekendTime) {
        // If not in weekend window, return the original chosen index
        return chosenIndex;
    }
    
    // Find the next item after Sunday 14:00
    for (let i = chosenIndex + 1; i < items.length; i++) {
        const nextItemTime = new Date(items[i].time);
        
        // Check if this item is after Sunday 14:00
        if (nextItemTime > sunday) {
            return i; // Found the next item after the weekend window
        }
    }
    
    // If no item found after Sunday 14:00, return the original index
    return chosenIndex;
}

// Alternative version that returns the actual item instead of index
export function getItemAfterWeekend(items, chosenIndex) {
    const nextIndex = chooseNextItemAfterWeekend(items, chosenIndex);
    return items[nextIndex];
}
