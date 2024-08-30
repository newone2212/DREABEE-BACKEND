// Import required modules
const express = require('express');

// Function to generate random male-female ratio data with given total people count and ratio
function generateMaleFemaleData(totalPeople, maleRatio) {
    const maleCount = Math.round(totalPeople * maleRatio);
    const femaleCount = totalPeople - maleCount;
    return { males: maleCount, females: femaleCount };
}

// Function to generate random age group distribution data
function generateAgeGroupData(totalPeople) {
    const ageGroups = [
        { range: '10-25', count: 0 },
        { range: '26-45', count: 0 },
        { range: '46-65', count: 0 },
        { range: 'above 65', count: 0 }
    ];

    for (let i = 0; i < totalPeople; i++) {
        const age = Math.floor(Math.random() * 100) + 1; // Generate random age between 1 and 100
        if (age >= 10 && age <= 25) {
            ageGroups[0].count++;
        } else if (age >= 26 && age <= 45) {
            ageGroups[1].count++;
        } else if (age >= 46 && age <= 65) {
            ageGroups[2].count++;
        } else {
            ageGroups[3].count++;
        }
    }

    return ageGroups;
}
// Function to calculate budget based on views and rate range
function calculateBudget(views, minRate, maxRate) {
    const rate = minRate + Math.random() * (maxRate - minRate); // Random rate between minRate and maxRate
    const budget = views * rate;
    return { budget, minBudget: views * minRate, maxBudget: views * maxRate }; // Include min and max budget in the response
}

// Function to process channel data
function processChannelData(channels, minRate, maxRate) {
    const processedChannels = channels.map(channel => {

        const { name, views } = channel;
        console.log(views)
        const { budget, minBudget, maxBudget } = calculateBudget(views, minRate, maxRate);
        return { name, budget, minBudget, maxBudget };
    });
    return processedChannels;
}



// Export controller functions
module.exports = {
    generateMaleFemaleData,
    generateAgeGroupData,
    processChannelData
};
