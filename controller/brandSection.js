const { response } = require('express');
const axios=require("axios")
const elasticClient = require('../db/conn');
const db = require("../db/onn2")
const cron=require("node-cron")
const { ObjectId } = require('mongodb');
const scrollTimeout = '30s'; 
const dataController=require("./utils")
const Username = require('../models/Username');
const connection=require("../db/conn3");
const { PythonShell } = require('python-shell');
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

// const connect2=require("../db/conn4")
// Function to get unique channel IDs from Elasticsearch
async function getUniqueChannelIds(brandName, from, size) {
    const response = await elasticClient.search({
        index: 'brand_videos',
        body: {
            from: from,
            size: size,
            query: {
                bool: {
                    should: [
                        { match_phrase: { "description": brandName } },
                        { term: { "tags.keyword": brandName.toLowerCase() } }
                    ],
                    minimum_should_match: 1
                }
            }
        }
    });

    const uniqueChannelIds = new Set();
    response.hits.hits.forEach(hit => {
        uniqueChannelIds.add(hit._source.channel);
    });

    return Array.from(uniqueChannelIds);
}

// Function to get the channel profile photo, language, and categories
async function getChannelDetails(channelId) {
    const endpoint = 'https://www.googleapis.com/youtube/v3/channels';
    const params = {
        part: 'snippet,contentDetails,brandingSettings',
        id: channelId,
        key: "AIzaSyBfwrYn8M5SuRDAc29lBNdXvl2OXAsweDM"
    };

    try {
        const response = await axios.get(endpoint, { params });
        if (response.status === 200) {
            const data = response.data;
            if (data.items && data.items.length > 0) {
                const channelData = data.items[0];
                const profilePhotoUrl = channelData.snippet.thumbnails.default.url;
                const language = channelData.snippet.defaultLanguage || 'Unknown';
                const categories = channelData.brandingSettings.channel.keywords || 'Unknown';

                return { profilePhotoUrl, language, categories };
            } else {
                return { profilePhotoUrl: null, language: 'Unknown', categories: 'Unknown' };
            }
        } else {
            return { profilePhotoUrl: null, language: 'Unknown', categories: 'Unknown' };
        }
    } catch (error) {
        return { profilePhotoUrl: null, language: 'Unknown', categories: 'Unknown' };
    }
}

// Function to get data for each channel ID from Elasticsearch
async function getChannelData(channelId, from, size) {
    const response = await elasticClient.search({
        index: 'channels',
        body: {
            from: from,
            size: size,
            query: {
                term: { 
                    _id: channelId // Search based on the ID
                }
            }
        }
    });

    const channelDetails = await getChannelDetails(channelId);

    return response.hits.hits.map(hit => ({
        ...hit._source,
        ...channelDetails
    }));
}

const constructExactMatchQuery = (queryParameters) => {
    const query = {
        bool: {
            must: []
        }
    };

    // Construct the query based on queryParameters
    for (const key in queryParameters) {
        if (queryParameters.hasOwnProperty(key) && queryParameters[key]) {
            if (key === 'product_promotion') {
                // For boolean fields, convert the string to boolean
                query.bool.must.push({ match: { [key]: queryParameters[key] === 'true' } });
            } else if (key === 'views' || key === 'likes' || key === 'comments') {
                // For numeric fields, parse the value to integer
                query.bool.must.push({ match: { [key]: parseInt(queryParameters[key]) } });
            } else {
                // For other fields, use match query for exact match
                query.bool.must.push({ match: { [`${key}.keyword`]: queryParameters[key] } });
            }
        }
    }

    return query;
};
function parseDuration(duration) {
    const parts = duration.split(':');
    let seconds = 0;
    let multiplier = 1;

    while (parts.length > 0) {
        seconds += multiplier * parseInt(parts.pop(), 10);
        multiplier *= 60;
    }

    return seconds;
}



// const elasticClient = require('../db/conn');  // Adjust the import according to your project structure

async function fetchPaidPromotions(brandName) {
    try {
        // Perform the search query
        const response = await elasticClient.search({
            index: 'brand_videos',
            body: {
                query: {
                    bool: {
                        should: [
                            { match_phrase: { "title": brandName } },
                            { match_phrase: { "description": brandName } }
                        ],
                        minimum_should_match: 1,
                        must: [
                            { term: { "product_promotion": true } },
                            {
                                range: {
                                    published_at: {
                                        gte: since,  // 'since' should be in a date format (e.g., '2021-01-01')
                                        lte: until   // 'until' should be in a date format (e.g., '2021-12-31')
                                    }
                                }
                            }
                        ]
                    }
                }
            }
        });

        // // Initialize variables to store unique channels and total count
        // const uniqueChannels = new Set();
        // let totalCount = 0;

        // // Iterate over the hits to extract channel IDs and count
        // response.hits.hits.forEach(hit => {
        //     uniqueChannels.add(hit._source.channel);
        //     totalCount++;
        // });

        // // Convert the Set of unique channels to an array
        // const channelsArray = Array.from(uniqueChannels);
        totalCount = await response.hits.count;
        console.log(totalCount)
        return totalCount
        // channels: channelsArray
    } catch (error) {
        console.error('Error fetching paid promotions:', error);
        throw error;
    }
}



module.exports = {
    getUniqueChannelIds:async(req, res)=>{
        const { brandName ,since,until} = req.body;
    
        if (!brandName) {
            return res.status(400).json({ error: "Brand name is required" });
        }
    
        try {
            // Step 1: Fetch unique channel IDs from Elasticsearch
            let uniqueChannelIds = new Set();
            let response = await elasticClient.search({
                index: 'brand_videos',
                scroll: '1m',
                body: {
                    size: 9000, // Adjust the size to control the amount of data retrieved in each scroll
                    query: {
                        bool: {
                            should: [
                                { match_phrase: { "description": brandName } },
                                { term: { "tags.keyword": brandName.toLowerCase() } }
                            ],
                            must: [
                                {
                                    range: {
                                        published_at: {
                                            gte: since,  // 'since' should be in a date format (e.g., '2021-01-01')
                                            lte: until   // 'until' should be in a date format (e.g., '2021-12-31')
                                        }
                                    }
                                }
                            ],
                            minimum_should_match: 1
                        }
                    }
                }
            });
    
            while (response.hits.hits.length) {
                response.hits.hits.forEach(hit => {
                    uniqueChannelIds.add(hit._source.channel);
                });
    
                response = await elasticClient.scroll({
                    scroll_id: response._scroll_id,
                    scroll: '1m'
                });
            }
    
            const channelIdsArray = Array.from(uniqueChannelIds);
            if (channelIdsArray.length === 0) {
                return res.json({ agePercentages: {}, genderPercentages: {} });
            }
    
            // Step 2: Fetch age and gender data from MySQL for each channel ID
            const placeholders = channelIdsArray.map(() => '?').join(',');
            const [rows] = await connection.query(
                `SELECT channel, age, gender FROM channel_gender_age WHERE channel IN (${placeholders})`,
                channelIdsArray
            );
    
            // Step 3: Calculate the percentage of each age range and gender
            const ageRanges = {
                '13-17': 0,
                '18-24': 0,
                '25-34': 0,
                '35-44': 0,
                '45-54': 0,
                '55-64': 0,
                '65+': 0,
                'unknown': 0
            };
    
            const genderCounts = {
                male: 0,
                female: 0,
                others: 0
            };
    
            rows.forEach(row => {
                const age = row.age || 0; // Default to 0 if age is null or undefined
    
                if (age >= 13 && age <= 17) ageRanges['13-17']++;
                else if (age >= 18 && age <= 24) ageRanges['18-24']++;
                else if (age >= 25 && age <= 34) ageRanges['25-34']++;
                else if (age >= 35 && age <= 44) ageRanges['35-44']++;
                else if (age >= 45 && age <= 54) ageRanges['45-54']++;
                else if (age >= 55 && age <= 64) ageRanges['55-64']++;
                else if (age >= 65) ageRanges['65+']++;
                else ageRanges['unknown']++;
    
                if (row.gender === 0) genderCounts.male++;
                else if (row.gender === 1) genderCounts.female++;
            });
    
            const totalChannels = channelIdsArray.length;
            const agePercentages = {};
    
            for (const range in ageRanges) {
                agePercentages[range] = ((ageRanges[range] / totalChannels) * 100).toFixed(2) + '%';
            }
    
            // Calculate gender percentages
            genderCounts.others = channelIdsArray.length - rows.length;
            const genderPercentages = {
                male: ((genderCounts.male / totalChannels) * 100).toFixed(2) + '%',
                female: ((genderCounts.female / totalChannels) * 100).toFixed(2) + '%',
                others: ((genderCounts.others / totalChannels) * 100).toFixed(2) + '%'
            };
    
            res.json({ agePercentages, genderPercentages,genderCounts });
        } catch (error) {
            console.error('Error fetching data:', error);
            res.status(500).send('Internal Server Error');
        }
    },
    generate:(req, res) => {
        try {
            const channels = req.body.channels;
            const minRate = req.body.minRate || 0.8; // Default minimum rate is 0.3
            const maxRate = req.body.maxRate || 1.9; // Default maximum rate is 1.2
    
            if (!channels || !Array.isArray(channels)) {
                return res.status(400).json({ error: 'Invalid request body' });
            }
            
            const processedChannels = dataController.processChannelData(channels, minRate, maxRate);
            res.status(200).json(processedChannels);
        } catch (error) {
            console.error("Error processing channel data:", error);
            res.status(500).json({ error: 'Internal Server Error' });
        }
    },
    deft: async (req, res) => {
        try {
            const response = await elasticClient.search({
                index: 'brand_videos',
                size: 60, // Retrieve only the first 10 entries
            });

            res.status(201).send(JSON.stringify(response, null, 2));
        } catch (error) {
            response.status(404).send(error);
        }
    },
    search: async (req, res) => {
        const {
            title,
            description,
            channel,
            category,
            language,
            country,
            product_promotion,
            duration,
            published_at,
            likes,
            views,
            comments,
            updated_at
        } = req.query;

        try {
            const query = {
                bool: {
                    must: []
                }
            };

            // Add search conditions based on query parameters
            if (title) query.bool.must.push({ match: { "title": title } });
            if (description) query.bool.must.push({ match: { "description": description } });
            if (channel) query.bool.must.push({ match: { "channel": channel } });
            if (category) query.bool.must.push({ match: { "category": category } });
            if (language) query.bool.must.push({ match: { "language": language } });
            if (country) query.bool.must.push({ match: { "country": country } });
            if (product_promotion) query.bool.must.push({ match: { "product_promotion": product_promotion } });
            if (duration) query.bool.must.push({ match: { "duration": duration } });
            if (published_at) query.bool.must.push({ match: { "published_at": published_at } });
            if (likes) query.bool.must.push({ match: { "likes": likes } });
            if (views) query.bool.must.push({ match: { "views": views } });
            if (comments) query.bool.must.push({ match: { "comments": comments } });
            if (updated_at) query.bool.must.push({ match: { "updated_at": updated_at } });

            const body = await elasticClient.search({
                index: 'brand_videos',
                body: {
                    query
                }
            });

            res.status(201).json(body);
        } catch (error) {
            console.error("Error searching in Elasticsearch:", error);
            res.status(404).json({ error: 'Internal Server Error' });
        }
    },
    exactMAtch: async (req, res) => {
        const queryParameters = req.query;

        try {
            const query = constructExactMatchQuery(queryParameters);

            const response = await elasticClient.search({
                index: 'brand_videos',
                body: { query },
            });

            res.status(200).json(response.hits.hits);
        } catch (error) {
            console.error("Error searching in Elasticsearch:", error);
            res.status(500).json({ error: 'Internal Server Error' });
        }
    },
    GetMentionGraph:async(req,res)=>{
        try {
            const brandName = req.body.name;
            const from = req.body.from ? parseInt(req.body.from) : 0; // Starting point
            const size = req.body.size ? parseInt(req.body.size) : 100;
            const since=req.body.since;
            const until=req.body.until;
            const to = req.body.size ? parseInt(req.body.to) : 10
            const response = await elasticClient.search({
                index: 'brand_videos',
                body: {
                    // from: from,
                    // size: size,
                    query: {
                        bool: {
                            must: [
                                {
                                    range: {
                                        published_at: {
                                            gte: since,  // 'since' should be in a date format (e.g., '2021-01-01')
                                            lte: until   // 'until' should be in a date format (e.g., '2021-12-31')
                                        }
                                    }
                                }
                            ],
                            should: [
                                { match_phrase: { "description": brandName } },  // Adjusted for `text` fields
                                { term: { "tags.keyword": brandName.toLowerCase() } }
                            ],
                            minimum_should_match: 1
                        }
                    }
                }
            });
            response.hits.hits.filter(s => {
                console.log(s)
            })
            res.status(200).json(response.hits.hits);
        } catch (error) {
            console.error('Error searching Elasticsearch:', error);
            res.status(500).json({ error: 'Internal Server Error' });
        }
    },
    searchBrand: async (req, res) => {
        try {
            const brandName = req.body.name;
            const from = req.body.from ? parseInt(req.body.from) : 0; // Starting point
            const size = req.body.size ? parseInt(req.body.size) : 100;
            const to = req.body.size ? parseInt(req.body.to) : 10
            const response = await elasticClient.search({
                index: 'brand_videos',
                body: {
                    from: from,
                    size: size,
                    query: {
                        bool: {
                            should: [
                                // { match: { "_source.description": brandName }},
                                // { match: { "_source.tags": brandName }}
                                // { match_phrase: { "title": brandName } },
                                { match_phrase: { "description": brandName } },  // Adjusted for `text` fields
                                { term: { "tags.keyword": brandName.toLowerCase() } }
                            ],
                            minimum_should_match: 1
                        }
                    }
                }
            });
            response.hits.hits.filter(s => {
                console.log(s)
            })
            res.status(200).json(response.hits.hits);
        } catch (error) {
            console.error('Error searching Elasticsearch:', error);
            res.status(500).json({ error: 'Internal Server Error' });
        }
    },
    searchBrandIntegrated: async (req, res) => {
        try {
            const { name: brandName, from = 0, size = 100, to = 10, since, until } = req.body;
    
            const response = await elasticClient.search({
                index: 'brand_videos',
                body: {
                    from: from,
                    size: size,
                    query: {
                        bool: {
                            should: [
                                { match_phrase: { "description": brandName } }
                            ],
                            minimum_should_match: 1,
                            must: [
                                {
                                    range: {
                                        published_at: {
                                            gte: since,  // 'since' should be in a date format (e.g., '2021-01-01')
                                            lte: until   // 'until' should be in a date format (e.g., '2021-12-31')
                                        }
                                    }
                                }
                            ]
                        }
                    }
                }
            });
    
            const totalHits = response.hits.total.value;
            const hits = response.hits.hits;
    
            // Helper function to determine the video type based on duration
            const getVideoType = (duration) => {
                const durationParts = duration.split(":");
                const hours = parseInt(durationParts[0], 10);
                const minutes = parseInt(durationParts[1], 10);
                const seconds = parseInt(durationParts[2], 10);
                const totalSeconds = hours * 3600 + minutes * 60 + seconds;
                return totalSeconds < 60 ? "short" : "video";
            };
    
            const results = hits.map(hit => {
                const videoType = getVideoType(hit._source.duration);
                return {
                    ...hit,
                    _source: {
                        ...hit._source,
                        videoType: videoType
                    }
                };
            });
    
            res.status(200).json({
                totalHits: totalHits,
                from: from,
                size: size,
                results: results
            });
        } catch (error) {
            console.error('Error searching Elasticsearch:', error);
            res.status(500).json({ error: 'Internal Server Error' });
        }
    },
    //Api for sentimental Analysis
    sentimentalAnalysisApi: async (req, res) => {
        try {
            const { name: brandName, from = 0, size = 100, to = 10, since, until } = req.body;
    
            const response = await elasticClient.search({
                index: 'brand_videos',
                body: {
                    from: from,
                    size: size,
                    query: {
                        bool: {
                            should: [
                                { match_phrase: { "title": brandName } }
                            ],
                            minimum_should_match: 1,
                            must: [
                                {
                                    range: {
                                        published_at: {
                                            gte: since,  // 'since' should be in a date format (e.g., '2021-01-01')
                                            lte: until   // 'until' should be in a date format (e.g., '2021-12-31')
                                        }
                                    }
                                }
                            ]
                        }
                    }
                }
            });
    
            const totalHits = response.hits.total.value;
            const hits = response.hits.hits;
    
            // Helper function to determine the video type based on duration
            const getVideoType = (duration) => {
                const durationParts = duration.split(":");
                const hours = parseInt(durationParts[0], 10);
                const minutes = parseInt(durationParts[1], 10);
                const seconds = parseInt(durationParts[2], 10);
                const totalSeconds = hours * 3600 + minutes * 60 + seconds;
                return totalSeconds < 60 ? "short" : "video";
            };
    
            const results = hits.map(hit => {
                const videoType = getVideoType(hit._source.duration);
                return {
                    ...hit,
                    _source: {
                        ...hit._source,
                        videoType: videoType
                    }
                };
            });
    
            res.status(200).json({
                totalHits: totalHits,
                from: from,
                size: size,
                results: results
            });
        } catch (error) {
            console.error('Error searching Elasticsearch:', error);
            res.status(500).json({ error: 'Internal Server Error' });
        }
    },
    Brands_sugesstion: async (req, res) => {
        try {
            const collection = db.collection("brandsdb");
            const records = await collection.find({}).sort({ createdAt: -1 }).limit(10).toArray();
            res.status(201).send(records);
        } catch (error) {
            res.status(400).send(error);
        }
    },
    brands_details: async (req, res) => {
        try {
            const id = req.params.id; // Get ID from query string
            // if (!ObjectId.isValid(id)) {
            //     return res.status(400).send({ message: "Invalid ID format" });
            // }
            const collection = db.collection("brandsdb");
            const record = await collection.findOne({ brand: { $regex: new RegExp(`^${id}$`, 'i') } });    // new ObjectId(id) Use new ObjectId(id) to ensure proper ID format

            if (!record) {
                return res.status(404).send({ message: "Brand not found" });
            }
            res.status(200).send(record);
        } catch (error) {
            console.error('Error fetching brand details:', error);
            res.status(500).send({ message: "Error fetching brand details", error });
        }
    },
    brands_Calculation: async (req, res) => {
        try {
            const id = req.params.id; // Get ID from query string
            // if (!ObjectId.isValid(id)) {
            //     return res.status(400).send({ message: "Invalid ID format" });
            // }
            const collection = db.collection("brands_data");
            const record = await collection.findOne({ brand: { $regex: new RegExp(`^${id}$`, 'i') } });    // new ObjectId(id) Use new ObjectId(id) to ensure proper ID format

            if (!record) {
                return res.status(404).send({ message: "Brand not found" });
            }
            res.status(200).send(record);
        } catch (error) {
            console.error('Error fetching brand details:', error);
            res.status(500).send({ message: "Error fetching brand details", error });
        }
    },
    brands_yt_details: async (req, res) => {
        try {
            const id = req.params.id; // Get ID from query string
            // if (!ObjectId.isValid(id)) {
            //     return res.status(400).send({ message: "Invalid ID format" });
            // }
            const collection = db.collection("youtubeBrands");
            const record = await collection.findOne({ keyword: { $regex: new RegExp(`^${id}$`, 'i') } });    // new ObjectId(id) Use new ObjectId(id) to ensure proper ID format

            if (!record) {
                return res.status(404).send({ message: "Brand not found" });
            }
            res.status(200).send(record);
        } catch (error) {
            console.error('Error fetching brand details:', error);
            res.status(500).send({ message: "Error fetching brand details", error });
        }
    },
    GetYoutubeBrands: async (req, res) => {
        try {
            const collection = db.collection("brands_data");
            const records = await collection.find({}).sort({ createdAt: -1 }).limit(3000).toArray();
            res.status(201).send(records);
        } catch (error) {
            res.status(400).send(error);
        }
    },
    GetInfluencerBrands: async (req, res) => {
        try {
            const collection = db.collection("InstaBrands");
            const records = await collection.find({}).sort({ createdAt: -1 }).limit(1000).toArray();
            res.status(201).send(records);
        } catch (error) {
            res.status(400).send(error);
        }
    },
    NewOne :async (req, res) => {
        try {
            const brandName = req.body.name;
            const from = req.body.from ? parseInt(req.body.from) : 0;
            const size = req.body.size ? parseInt(req.body.size) : 100;
    
            // Get unique channel IDs
            const uniqueChannelIds = await getUniqueChannelIds(brandName, from, size);
    
            // Collect data for each channel ID
            const channelDataPromises = uniqueChannelIds.map(channelId => getChannelData(channelId, from, size));
            const channelDataResults = await Promise.all(channelDataPromises);
    
            // Flatten the array of arrays
            const allChannelData = [].concat(...channelDataResults);
    
            res.status(200).json(allChannelData);
        } catch (error) {
            console.error('Error searching Elasticsearch:', error);
            res.status(500).json({ error: 'Internal Server Error' });
        }
    },
    updateit: async (req, res) => {
        try {
            const { brandName } = req.query; // Assuming brandName is passed in the query parameters
    
            const brandTotalVedios = await elasticClient.count({
                index: 'brand_videos',
                body: {
                    query: {
                        bool: {
                            should: [
                                { match_phrase: { "title": brandName } },
                                { match_phrase: { "description": brandName } },
                                // { term: { "product_promotion": true } } // Filter videos with product promotion
                            ],
                            minimum_should_match: 1
                        }
                    }
                }
            });
            console.log(brandTotalVedios.count)
            const IntegreatedVedios = await elasticClient.count({
                index: 'brand_videos',
                body: {
                    query: {
                        bool: {
                            should: [
                                { match_phrase: { "title": brandName } },
                                // { match_phrase: { "description": brandName } },
                                // { term: { "product_promotion": true } } // Filter videos with product promotion
                            ],
                            minimum_should_match: 1
                        }
                    }
                }
            });
            
            const dedicatedVedios = await elasticClient.count({
                index: 'brand_videos',
                body: {
                    query: {
                        bool: {
                            should: [
                                // { match_phrase: { "title": brandName } },
                                { match_phrase: { "description": brandName } },
                                 // Filter videos with product promotion
                            ],
                            minimum_should_match: 1
                        }
                    }
                }
            });
            console.log(dedicatedVedios.count)
    
            // if (!totalVideosResponse || !totalVideosResponse || typeof totalVideosResponse.count === 'undefined') {
            //     throw new Error('Failed to get total videos count');
            // }
    
            const totalVideos = brandTotalVedios.count;
            const InetgratedVediosCount=IntegreatedVedios.count;
            const dedicatedVediosCount=dedicatedVedios.count;

            // const admentions=totalVideosResponse.count-totalVideosResponse1.count;
    
            // Use Scroll API to fetch all video details
            let scrollId = null;
            let allHitss = [];
            let totalLength = 0;
            let totalViews = 0;
            const uniqueChannelIds = [];
            const responsePaid = await elasticClient.search({
                index: 'brand_videos',
                scroll: scrollTimeout,
                body: {
                    size: 9000,
                    query: {
                        bool: {
                            minimum_should_match: 1,
                            should: [
                                { match_phrase: { "description": brandName } },
                                { match_phrase: { "title": brandName } }
                            ],
                            must: [
                                { term: { "product_promotion": true } }
                            ]
                        }
                    }
                }
            });
    
            // let scrollIds = response._scroll_id;
            let totalPaidViews = 0;
            // const uniqueChannels = new Set();
    
            // Process initial batch of results
            responsePaid.hits.hits.forEach(hit => {
                totalPaidViews += parseInt(hit._source.views, 10);
                // uniqueChannels.add(hit._source.channel);
            });
            console.log("hii")
            const initialResponse = await elasticClient.search({
                index: 'brand_videos',
                scroll: scrollTimeout,
                body: {
                    size: 9000,
                    query: {
                        bool: {
                            should:[
                                { match_phrase: { "description": brandName } },
                                { match_phrase: { "title": brandName } }
                            ],
                            minimum_should_match: 1,
                            // must: [
                            //     { term: { "product_promotion": true } }
                            // ]
                        }
                    }
                }
            });

            // const paidPromotionCount= paidPromotion.count;
            const results=await elasticClient.search({
                index: 'brand_videos',
                body: {
                    query: {
                        bool: {
                            minimum_should_match: 1,
                            should:[
                                { match_phrase: { "description": brandName } },
                                { match_phrase: { "title": brandName } }
                            ],
                            must: [
                                { term: { "product_promotion": true } }
                            ]
                        }
                    }
                }
            });
            // console.log(results)
            let allHits=[]
            const paidPromotionCount=results.hits.total.value;
            console.log("Hii")
            scrollId = initialResponse._scroll_id;
            allHits = initialResponse.hits.hits;
    
            while (allHits.length < totalVideos) {
                const scrollResponse = await elasticClient.scroll({
                    scroll_id: scrollId,
                    scroll: scrollTimeout
                });
    
                scrollId = scrollResponse._scroll_id;
                allHits = allHits.concat(scrollResponse.hits.hits);
    
                if (scrollResponse.hits.hits.length === 0) break;
            }
    
            // Calculate total length and views
            await allHits.forEach(hit => {
                totalLength += parseDuration(hit._source.duration);
                totalViews += parseInt(hit._source.views);
                // Collect unique channel IDs
                if (!uniqueChannelIds.includes(hit._source.channel)) {
                    uniqueChannelIds.push(hit._source.channel);
                }
            });
            const channelsData=uniqueChannelIds.length            // Fetch additional information about each channel in batches
            // const channelDetails = [];

            // const batchSize = 9000;
            // for (let i = 0; i < uniqueChannelIds.length; i += batchSize) {
            //     const batchIds = uniqueChannelIds.slice(i, i + batchSize);
            //     const batchResponse = await elasticClient.search({
            //         index: 'channels',
            //         body: {
            //             size: batchSize,
            //             query: {
            //                 ids: {
            //                     values: batchIds
            //                 }
            //             }
            //         }
            //     });
            //     channelDetails.push(...batchResponse.hits.hits);
            // }
            const logEntry={
                brandName:brandName,
                channelsData,
                paidPromotionCount,
                totalVideos,
                InetgratedVediosCount,
                dedicatedVediosCount,
                totalViews,
                totalLength,
                totalPaidViews
            }
            console.log(logEntry)
            await  res.status(201).send(logEntry)
            // const channels={
            //     "name":brandName,
            //     "views":totalViews   
            // }
            // const chin={
            //     "name":brandName,
            //     "views":channelsData
            // }
            // const brandDetails = await module.exports.brands_details({id:brandName});
            // console.log(brandDetails)
            // const InetgratedVedios = await module.exports.InetgratedVedios(brandName);
            // const dedicated = await module.exports.sentimentalAnalysisApi(brandName);
            // const processedChannels = await this.generate({ channels:channels });
            // const processedChannel = await this.generate({ channels:chin });
            // // Prepare the log entry
            // const logEntry = await  {
            //     brand: brandName,
            //     totalLength,
            //     channelsData,
            //     "totalViews":totalViews,
            //     hits: allHits,
            //     channelDetails,
            //     "brand_budget":processedChannels,
            //     "influencer_budget":processedChannel,
            //     "brandsDetail":brandDetails,
            //     "integrate":InetgratedVedios,
            //     "dedicated":dedicated,
            //     "admention":admentions,
            //     "mention":totalVideosResponse.count
            // };
            // // Append the results to an external JSON file
            // const record=await axios.post('https://middleware.project-tester.cloud/index.json', logEntry, {
            //     headers: {
            //         'Content-Type': 'application/json'
            //     }
            // }).then(()=>{
            //     res.status(200).send({ message: 'Successfully updated brand videos information'});
            // }).catch((error)=>{
            //     res.status(400).send(error)
            // });
    
            // Respond with a success message
            
        } catch (error) {
            console.error('Error in updateit function:', error);
            res.status(500).send(error.message || 'Internal Server Error');
        }
    },
    // GetYoutubeBrands: async (req, res) => {
    //     try {
    //         const collection = db.collection("youtubeBrands");
    //         const records = await collection.find({}).toArray();
    //         console.log(records)
    //         for (const record of records) {
    //             const brandName = record.keyword;
    //             await this.updateit(brandName);
    //         }
    //         res.status(201).send("Successfully updated brand videos information");
    //     } catch (error) {
    //         res.status(400).send(error);
    //     }
    // },
    getBrandDetailes : async (req, res) => {
        try {
            const { brandName } = req.query; // Get the brand name from the query parameters
    
            // Fetch the JSON data from the external URL
            const response = await axios.get('https://middleware.project-tester.cloud/index.json');
            console.log(response)
    
            // Filter the data based on the brand name
            const brandDetails = response.data.filter(entry => entry.brand === brandName);
    
            // If brand details are found, return them
            if (brandDetails.length > 0) {
                res.status(200).json(brandDetails);
            } else {
                res.status(404).json({ message: 'Brand details not found' });
            }
        } catch (error) {
            console.error('Error fetching brand details:', error);
            res.status(500).json({ error: 'Internal Server Error' });
        }
    },
    //comparitive data 
    // getBrandVideoStats : async (req, res) => {
    //     const {
    //         brandName,
    //         since, // 'since' should be in a date format (e.g., '2024-01-01')
    //         until // 'until' should be in a date format (e.g., '2024-02-01')
    //     } = req.body;
    
    //     try {
    //         const sinceDate = new Date(since);
    //         const untilDate = new Date(until);
    
    //         if (isNaN(sinceDate) || isNaN(untilDate)) {
    //             return res.status(400).json({ error: 'Invalid date format' });
    //         }
    
    //         const dateRangeDays = Math.ceil((untilDate - sinceDate) / (1000 * 60 * 60 * 24));
    //         const prevUntilDate = new Date(sinceDate);
    //         prevUntilDate.setDate(prevUntilDate.getDate() - 1);
    //         const prevSinceDate = new Date(prevUntilDate);
    //         prevSinceDate.setDate(prevSinceDate.getDate() - dateRangeDays);
    
    //         const formatDateString = date => date.toISOString().split('T')[0];
    
    //         const queryForRange = (startDate, endDate) => ({
    //             bool: {
    //                 must: [
    //                     {
    //                         range: {
    //                             published_at: {
    //                                 gte: startDate,
    //                                 lte: endDate
    //                             }
    //                         }
    //                     }
    //                 ],
    //                 should: [
    //                     { match_phrase: { title: brandName } },
    //                     { match_phrase: { description: brandName } }
    //                 ],
    //                 minimum_should_match: 1
    //             }
    //         });
    
    //         const fetchAllResults = async (query) => {
    //             let allResults = [];
    //             const scrollTimeout = '1m';
    //             let response = await elasticClient.search({
    //                 index: 'brand_videos',
    //                 scroll: scrollTimeout,
    //                 size: 10000, // Fetch in chunks of 10,000
    //                 body: { query }
    //             });
    
    //             allResults = allResults.concat(response.hits.hits);
    //             while (response.hits.total.value > allResults.length) {
    //                 response = await elasticClient.scroll({
    //                     scroll_id: response._scroll_id,
    //                     scroll: scrollTimeout
    //                 });
    //                 allResults = allResults.concat(response.hits.hits);
    //             }
    
    //             return allResults;
    //         };
    
    //         // Fetch data for the specified date range
    //         const currentRangeQuery = queryForRange(formatDateString(sinceDate), formatDateString(untilDate));
    //         const currentVideos = await fetchAllResults(currentRangeQuery);
    
    //         const currentTotalViews = currentVideos.reduce((sum, video) => sum + parseInt(video._source.views, 10), 0);
    //         const currentUniqueChannels = new Set(currentVideos.map(video => video._source.channel)).size;
    //         const currentPaidPromotionVideos = currentVideos.filter(video => video._source.product_promotion);
    //         const currentPaidPromotionViews = currentPaidPromotionVideos.reduce((sum, video) => sum + parseInt(video._source.views, 10), 0);
    //         const currentTotalVideos = currentVideos.length;
    
    //         // Fetch data for the previous equivalent date range
    //         const prevRangeQuery = queryForRange(formatDateString(prevSinceDate), formatDateString(prevUntilDate));
    //         const prevVideos = await fetchAllResults(prevRangeQuery);
    
    //         const prevTotalViews = prevVideos.reduce((sum, video) => sum + parseInt(video._source.views, 10), 0);
    //         const prevUniqueChannels = new Set(prevVideos.map(video => video._source.channel)).size;
    //         const prevPaidPromotionVideos = prevVideos.filter(video => video._source.product_promotion);
    //         const prevPaidPromotionViews = prevPaidPromotionVideos.reduce((sum, video) => sum + parseInt(video._source.views, 10), 0);
    //         const prevTotalVideos = prevVideos.length;
    
    //         // Calculate percentage changes
    //         const calculatePercentageChange = (current, previous) => {
    //             if (previous === 0) return current > 0 ? 100 : 0;
    //             return ((current - previous) / previous) * 100;
    //         };
    
    //         const viewsChangePercentage = calculatePercentageChange(currentTotalViews, prevTotalViews);
    //         const uniqueChannelsChangePercentage = calculatePercentageChange(currentUniqueChannels, prevUniqueChannels);
    //         const paidPromotionViewsChangePercentage = calculatePercentageChange(currentPaidPromotionViews, prevPaidPromotionViews);
    //         const totalVideosChangePercentage = calculatePercentageChange(currentTotalVideos, prevTotalVideos);
    
    //         // Construct the result
    //         const result = {
    //             current: {
    //                 totalViews: currentTotalViews,
    //                 uniqueChannels: currentUniqueChannels,
    //                 paidPromotionVideos: currentPaidPromotionVideos.length,
    //                 paidPromotionViews: currentPaidPromotionViews,
    //                 totalVideos: currentTotalVideos
    //             },
    //             previous: {
    //                 totalViews: prevTotalViews,
    //                 uniqueChannels: prevUniqueChannels,
    //                 paidPromotionVideos: prevPaidPromotionVideos.length,
    //                 paidPromotionViews: prevPaidPromotionViews,
    //                 totalVideos: prevTotalVideos
    //             },
    //             changePercentage: {
    //                 views: viewsChangePercentage,
    //                 uniqueChannels: uniqueChannelsChangePercentage,
    //                 paidPromotionViews: paidPromotionViewsChangePercentage,
    //                 totalVideos: totalVideosChangePercentage
    //             }
    //         };
    
    //         res.status(200).json(result);
    //     } catch (error) {
    //         console.error("Error searching in Elasticsearch:", error);
    //         res.status(500).json({ error: 'Internal Server Error' });
    //     }
    // },
    getBrandVideoStats : async (req, res) => {
        const {
            brandName,
            since, // 'since' should be in a date format (e.g., '2024-01-01')
            until // 'until' should be in a date format (e.g., '2024-02-01')
        } = req.body;
    
        try {
            const sinceDate = new Date(since);
            const untilDate = new Date(until);
    
            if (isNaN(sinceDate) || isNaN(untilDate)) {
                return res.status(400).json({ error: 'Invalid date format' });
            }
    
            const dateRangeDays = Math.ceil((untilDate - sinceDate) / (1000 * 60 * 60 * 24));
            const prevUntilDate = new Date(sinceDate);
            prevUntilDate.setDate(prevUntilDate.getDate() - 1);
            const prevSinceDate = new Date(prevUntilDate);
            prevSinceDate.setDate(prevSinceDate.getDate() - dateRangeDays);
    
            const formatDateString = date => date.toISOString().split('T')[0];
    
            const queryForRange = (startDate, endDate) => ({
                bool: {
                    must: [
                        {
                            range: {
                                published_at: {
                                    gte: startDate,
                                    lte: endDate
                                }
                            }
                        }
                    ],
                    should: [
                        { match_phrase: { title: brandName } },
                        { match_phrase: { description: brandName } }
                    ],
                    minimum_should_match: 1
                }
            });
    
            const fetchAllResults = async (query) => {
                let allResults = [];
                const scrollTimeout = '1m';
                let response = await elasticClient.search({
                    index: 'brand_videos',
                    scroll: scrollTimeout,
                    size: 10000, // Fetch in chunks of 10,000
                    body: { query }
                });
    
                allResults = allResults.concat(response.hits.hits);
                while (response.hits.total.value > allResults.length) {
                    response = await elasticClient.scroll({
                        scroll_id: response._scroll_id,
                        scroll: scrollTimeout
                    });
                    allResults = allResults.concat(response.hits.hits);
                }
    
                return allResults;
            };
    
            // Fetch data for the specified date range
            const currentRangeQuery = queryForRange(formatDateString(sinceDate), formatDateString(untilDate));
            const currentVideos = await fetchAllResults(currentRangeQuery);
    
            const currentTotalViews = currentVideos.reduce((sum, video) => sum + parseInt(video._source.views, 10), 0);
            const currentUniqueChannels = new Set(currentVideos.map(video => video._source.channel)).size;
            const currentPaidPromotionVideos = currentVideos.filter(video => video._source.product_promotion);
            const currentPaidPromotionViews = currentPaidPromotionVideos.reduce((sum, video) => sum + parseInt(video._source.views, 10), 0);
            const currentTotalVideos = currentVideos.length;
            const currentPaidTotalVideos = currentPaidPromotionVideos.length;
    
            // Fetch data for the previous equivalent date range
            const prevRangeQuery = queryForRange(formatDateString(prevSinceDate), formatDateString(prevUntilDate));
            const prevVideos = await fetchAllResults(prevRangeQuery);
    
            const prevTotalViews = prevVideos.reduce((sum, video) => sum + parseInt(video._source.views, 10), 0);
            const prevUniqueChannels = new Set(prevVideos.map(video => video._source.channel)).size;
            const prevPaidPromotionVideos = prevVideos.filter(video => video._source.product_promotion);
            const prevPaidPromotionViews = prevPaidPromotionVideos.reduce((sum, video) => sum + parseInt(video._source.views, 10), 0);
            const prevTotalVideos = prevVideos.length;
            const prevPaidTotalVideos = prevPaidPromotionVideos.length;
    
            // Calculate percentage changes
            const calculatePercentageChange = (current, previous) => {
                if (previous === 0) return current > 0 ? 100 : 0;
                return ((current - previous) / previous) * 100;
            };
    
            const viewsChangePercentage = calculatePercentageChange(currentTotalViews, prevTotalViews);
            const uniqueChannelsChangePercentage = calculatePercentageChange(currentUniqueChannels, prevUniqueChannels);
            const paidPromotionViewsChangePercentage = calculatePercentageChange(currentPaidPromotionViews, prevPaidPromotionViews);
            const totalVideosChangePercentage = calculatePercentageChange(currentTotalVideos, prevTotalVideos);
            const paidTotalVideosChangePercentage = calculatePercentageChange(currentPaidTotalVideos, prevPaidTotalVideos);
    
            // Construct the result
            const result = {
                current: {
                    totalViews: currentTotalViews,
                    uniqueChannels: currentUniqueChannels,
                    paidPromotionVideos: currentPaidPromotionVideos.length,
                    paidPromotionViews: currentPaidPromotionViews,
                    totalVideos: currentTotalVideos,
                    paidTotalVideos: currentPaidTotalVideos
                },
                previous: {
                    totalViews: prevTotalViews,
                    uniqueChannels: prevUniqueChannels,
                    paidPromotionVideos: prevPaidPromotionVideos.length,
                    paidPromotionViews: prevPaidPromotionViews,
                    totalVideos: prevTotalVideos,
                    paidTotalVideos: prevPaidTotalVideos
                },
                changePercentage: {
                    views: viewsChangePercentage,
                    uniqueChannels: uniqueChannelsChangePercentage,
                    paidPromotionViews: paidPromotionViewsChangePercentage,
                    totalVideos: totalVideosChangePercentage,
                    paidTotalVideos: paidTotalVideosChangePercentage
                }
            };
    
            res.status(200).json(result);
        } catch (error) {
            console.error("Error searching in Elasticsearch:", error);
            res.status(500).json({ error: 'Internal Server Error' });
        }
    },
    getBrandVideoAverageStats: async (req, res) => {
        const {
            brandName,
            since, // 'since' should be in a date format (e.g., '2024-01-01')
            until // 'until' should be in a date format (e.g., '2024-02-01')
        } = req.body;
    
        try {
            const sinceDate = new Date(since);
            const untilDate = new Date(until);
    
            if (isNaN(sinceDate) || isNaN(untilDate)) {
                return res.status(400).json({ error: 'Invalid date format' });
            }
    
            const dateRangeDays = Math.ceil((untilDate - sinceDate) / (1000 * 60 * 60 * 24));
            const prevUntilDate = new Date(sinceDate);
            prevUntilDate.setDate(prevUntilDate.getDate() - 1);
            const prevSinceDate = new Date(prevUntilDate);
            prevSinceDate.setDate(prevSinceDate.getDate() - dateRangeDays);
    
            const formatDateString = date => date.toISOString().split('T')[0];
    
            const queryForRange = (startDate, endDate, includePromotion = false) => ({
                bool: {
                    must: [
                        {
                            range: {
                                published_at: {
                                    gte: startDate,
                                    lte: endDate
                                }
                            }
                        },
                        ...(includePromotion ? [{ term: { "product_promotion": true } }] : [])
                    ],
                    should: [
                        { match_phrase: { title: brandName } },
                        { match_phrase: { description: brandName } }
                    ],
                    minimum_should_match: 1
                }
            });
    
            const fetchAllResults = async (query) => {
                let allResults = [];
                const scrollTimeout = '1m';
                let response = await elasticClient.search({
                    index: 'brand_videos',
                    scroll: scrollTimeout,
                    size: 10000, // Fetch in chunks of 10,000
                    body: { query }
                });
    
                allResults = allResults.concat(response.hits.hits);
                while (response.hits.total.value > allResults.length) {
                    response = await elasticClient.scroll({
                        scroll_id: response._scroll_id,
                        scroll: scrollTimeout
                    });
                    allResults = allResults.concat(response.hits.hits);
                }
    
                return allResults;
            };
    
            const getChannelSubscribers = async (channelIds) => {
                const response = await elasticClient.search({
                    index: 'channels',
                    body: {
                        query: {
                            terms: {
                                _id: channelIds
                            }
                        },
                        size: 10000
                    }
                });
                return response.hits.hits.reduce((acc, hit) => {
                    acc[hit._id] = parseInt(hit._source.subscribers, 10);
                    return acc;
                }, {});
            };
    
            const calculateMetrics = async (videos) => {
                const totalViews = videos.reduce((sum, video) => sum + parseInt(video._source.views, 10), 0);
                const uniqueChannels = Array.from(new Set(videos.map(video => video._source.channel)));
                const totalLikes = videos.reduce((sum, video) => sum + parseInt(video._source.likes, 10), 0);
                const totalComments = videos.reduce((sum, video) => sum + parseInt(video._source.comments, 10), 0);
                const totalVideos = videos.length;
    
                const avgViews = totalVideos > 0 ? totalViews / totalVideos : 0;
    
                const channelSubscribers = await getChannelSubscribers(uniqueChannels);
                const totalSubscribers = Object.values(channelSubscribers).reduce((sum, subs) => sum + subs, 0);
                const avgSubscribers = uniqueChannels.length > 0 ? totalSubscribers / uniqueChannels.length : 0;
    
                // Calculate ER for each video and aggregate by channel
                const channelERs = {};
                for (const video of videos) {
                    const channelId = video._source.channel;
                    const views = parseInt(video._source.views, 10);
                    const likes = parseInt(video._source.likes, 10);
                    const comments = parseInt(video._source.comments, 10);
    
                    if (views > 0) {
                        const er = (likes + comments) / views;
                        if (!channelERs[channelId]) {
                            channelERs[channelId] = [];
                        }
                        channelERs[channelId].push(er);
                    }
                }
    
                // Calculate average ER for each channel
                const avgERPerChannel = uniqueChannels.reduce((sum, channelId) => {
                    if (channelERs[channelId] && channelERs[channelId].length > 0) {
                        const avgER = channelERs[channelId].reduce((a, b) => a + b, 0) / channelERs[channelId].length;
                        return sum + avgER;
                    }
                    return sum;
                }, 0);
                const avgER = uniqueChannels.length > 0 ? avgERPerChannel / uniqueChannels.length : 0;
    
                // Calculate average price per influencer within range [0.8, 1.2]
                const totalInfluencerPrice = uniqueChannels.length * ((1.2 - 0.8) / 2 + 0.8);
                const avgPricePerInfluencer = uniqueChannels.length > 0 ? totalInfluencerPrice / uniqueChannels.length : 0;
    
                return {
                    totalViews,
                    uniqueChannels: uniqueChannels.length,
                    totalLikes,
                    totalComments,
                    totalSubscribers,
                    totalVideos,
                    avgViews,
                    avgSubscribers,
                    avgER,
                    avgPricePerInfluencer,
                    paidTotalVideos: totalLikes + totalComments // Total of likes and comments
                };
            };
    
            // Fetch data for the specified date range
            const currentRangeQuery = queryForRange(formatDateString(sinceDate), formatDateString(untilDate));
            const currentVideos = await fetchAllResults(currentRangeQuery);
            const currentMetrics = await calculateMetrics(currentVideos);
    
            // Fetch data for the previous equivalent date range
            const prevRangeQuery = queryForRange(formatDateString(prevSinceDate), formatDateString(prevUntilDate));
            const prevVideos = await fetchAllResults(prevRangeQuery);
            const prevMetrics = await calculateMetrics(prevVideos);
    
            // Fetch data for the paid promotion videos in the specified date range
            const currentPaidRangeQuery = queryForRange(formatDateString(sinceDate), formatDateString(untilDate), true);
            const currentPaidVideos = await fetchAllResults(currentPaidRangeQuery);
            const currentPaidMetrics = await calculateMetrics(currentPaidVideos);
    
            // Fetch data for the paid promotion videos in the previous equivalent date range
            const prevPaidRangeQuery = queryForRange(formatDateString(prevSinceDate), formatDateString(prevUntilDate), true);
            const prevPaidVideos = await fetchAllResults(prevPaidRangeQuery);
            const prevPaidMetrics = await calculateMetrics(prevPaidVideos);
    
            // Calculate percentage changes
            const calculatePercentageChange = (current, previous) => {
                if (previous === 0) return current > 0 ? 100 : 0;
                return ((current - previous) / previous) * 100;
            };
    
            const viewsChangePercentage = calculatePercentageChange(currentMetrics.totalViews, prevMetrics.totalViews);
            const uniqueChannelsChangePercentage = calculatePercentageChange(currentMetrics.uniqueChannels, prevMetrics.uniqueChannels);
            const paidPromotionViewsChangePercentage = calculatePercentageChange(currentPaidMetrics.totalViews, prevPaidMetrics.totalViews);
            const totalVideosChangePercentage = calculatePercentageChange(currentMetrics.totalVideos, prevMetrics.totalVideos);
            const paidTotalVideosChangePercentage = calculatePercentageChange(currentPaidMetrics.totalVideos, prevPaidMetrics.totalVideos);
    
            // Construct the result
            const result = {
                current: {
                    totalViews: currentMetrics.totalViews,
                    uniqueChannels: currentMetrics.uniqueChannels,
                    totalVideos: currentMetrics.totalVideos,
                    avgViews: currentMetrics.avgViews,
                    avgSubscribers: currentMetrics.avgSubscribers,
                    avgER: currentMetrics.avgER,
                    avgPricePerInfluencer: currentMetrics.avgPricePerInfluencer,
                    paidTotalVideos: currentPaidMetrics.totalVideos // Current paid total videos
                },
                previous: {
                    totalViews: prevMetrics.totalViews,
                    uniqueChannels: prevMetrics.uniqueChannels,
                    totalVideos: prevMetrics.totalVideos,
                    avgViews: prevMetrics.avgViews,
                    avgSubscribers: prevMetrics.avgSubscribers,
                    avgER: prevMetrics.avgER,
                    avgPricePerInfluencer: prevMetrics.avgPricePerInfluencer,
                    paidTotalVideos: prevPaidMetrics.totalVideos // Previous paid total videos
                },
                changePercentage: {
                    views: viewsChangePercentage,
                    uniqueChannels: uniqueChannelsChangePercentage,
                    paidPromotionViews: paidPromotionViewsChangePercentage,
                    totalVideos: totalVideosChangePercentage,
                    paidTotalVideos: paidTotalVideosChangePercentage // Change percentage for paid total videos
                }
            };
    
            res.status(200).json(result);
        } catch (error) {
            console.error("Error searching in Elasticsearch:", error);
            res.status(500).json({ error: 'Internal Server Error' });
        }
    },
    getProfilePhoto:async (req, res) => {
        try {
            const keyword = req.body.keyword;
            const token=req.body.token;
            console.log(keyword)
            const user = await Username.findOne({Keyword:keyword})
            console.log(user)    // new ObjectId(id) Use new ObjectId(id) to ensure proper ID format
            if (!user || !user.username) {
                return res.status(404).json({ error: 'Keyword or username not found' });
            }
    
            // Remove '@' from the username if it exists
            const username = user.username.replace('@', '');
            console.log(username)
            const response = await axios.get(`https://graph.facebook.com/v11.0/17841433401221135?fields=business_discovery.username(${username}){profile_picture_url,biography}&access_token=${token}`);
            
            if (response.data && response.data.business_discovery) {
                const profilePictureUrl = response.data.business_discovery.profile_picture_url;
                const description=response.data.business_discovery.biography;
                res.json({ profilePictureUrl ,description});
            } else {
                res.status(404).json({ error: 'Profile not found' });
            }
        } catch (error) {
            console.error(error);
            res.status(500).json({ error: 'An error occurred while fetching the profile picture' });
        }
    },
    getChannelLanguage: async (req, res) => {
        try {
            const channelId = req.params.id;
            
            const videoResponse = await elasticClient.search({
                index: 'brand_videos',
                body: {
                    query: {
                        term: {
                            channel: channelId // Search videos based on the channel ID
                        }
                    },
                    size: 1 // Fetch only one video to get the language
                }
            });
            
            const videoData = videoResponse.hits.hits;
            
            if (videoData.length === 0) {
                return res.status(404).json({ error: 'No videos found for this channel' });
            }
            
            let language = videoData[0]._source.language;
            
            if (!language) {
                language = 'English';
            }
            
            res.status(200).json({ language });
        } catch (error) {
            console.error("Error fetching language from Elasticsearch:", error);
            res.status(500).json({ error: 'Internal Server Error' });
        }
    },
    getBrandProfile:async (req, res) => {
        try {
            const keyword = req.params.keyword;
            const collection = db.collection("images_with_keywords");
    
            // Find records with a case-insensitive regex match
            const records = await collection.find({ 
                keyword: { $regex: new RegExp(`^${keyword}$`, 'i') }
            }).toArray();
    
            if (records.length === 0) {
                return res.status(404).send({ message: "No images found for the keyword." });
            }
    
            res.status(200).json(records);
        } catch (error) {
            console.error(error);
            res.status(500).send({ message: "Internal Server Error" });
        }
    },
    cities_distribution: async (req, res) => {
        const country = req.query.country;
        const countryPercentage = parseFloat(req.query.countryPercentage);
        const brandCategory = req.query.brandCategory;
        const brandName = req.query.brandName;
    
        try {
            const collection = db.collection("countries_cities");
            const countryData = await collection.findOne({ country: country });
    
            if (!countryData) {
                return res.status(404).json({ error: "Country not found in MongoDB" });
            }
    
            const cities = countryData.cities;
    
            const data = {
                country: country,
                countryPercentage: countryPercentage,
                brandCategory: brandCategory,
                brandName: brandName,
                cities: cities
            };
    
            const jsonData = JSON.stringify(data);
    
            // Write input JSON to a temporary file
            const inputFilePath = path.join(os.tmpdir(), 'input_data.json');
            fs.writeFileSync(inputFilePath, jsonData);
    
            // Prepare the output file path
            const outputFilePath = path.join(os.tmpdir(), 'output_data.json');
    
            // Prepare the command to run the Python script
            const command = `python predict.py "${inputFilePath}" "${outputFilePath}"`;
    
            exec(command, (error, stdout, stderr) => {
                fs.unlinkSync(inputFilePath);  // Cleanup input file
    
                if (error) {
                    return res.status(500).json({ error: error.message });
                }
    
                if (stderr) {
                    return res.status(500).json({ error: stderr });
                }
    
                // Read and return the output from the Python script
                fs.readFile(outputFilePath, 'utf8', (err, outputData) => {
                    fs.unlinkSync(outputFilePath);  // Cleanup output file
    
                    if (err) {
                        return res.status(500).json({ error: "Error reading output data" });
                    }
    
                    try {
                        const response = JSON.parse(outputData);
                        res.json(response);
                    } catch (parseError) {
                        return res.status(500).json({ error: "Error parsing output data" });
                    }
                });
            });
    
        } catch (err) {
            return res.status(500).json({ error: err.message });
        }
    }
    
}

// // Schedule the GetYoutubeBrands function to run every 3 hours
// cron.schedule('0 */3 * * *', async () => {
//     try {
//         await this.GetYoutubeBrands({}, { send: () => {} }); // Pass empty req and res objects
//         console.log("GetYoutubeBrands executed successfully");
//     } catch (error) {
//         console.error("Error executing GetYoutubeBrands:", error);
//     }
// });
