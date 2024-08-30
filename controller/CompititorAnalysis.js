const { response } = require('express');
const axios = require("axios")
const elasticClient = require('../db/conn');
const db = require("../db/onn2")
const cron = require("node-cron")
const { ObjectId } = require('mongodb');
const scrollTimeout = '30s';
const dataController = require("./utils")


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
        console.error("Error fetching channel details from YouTube API:", error);
        return { profilePhotoUrl: null, language: 'Unknown', categories: 'Unknown' };
    }
}

module.exports = {
    getFilterVedios: async (req, res) => {
        const {
            title,
            description,
            channel,
            category,
            language = [], // Default to empty array if not provided
            country = [], // Default to empty array if not provided
            product_promotion,
            duration,
            published_at,
            min_likes,
            max_likes,
            min_views,
            max_views,
            min_comments,
            max_comments,
            min_followers,
            max_followers,
            search_by = 'both', // Default to 'both' if not provided, options: 'title', 'description', 'both'
            keyword,
            page = 1, // Default to page 1 if not provided
            size = 60 // Default to 60 results per page if not provided
        } = req.body;
    
        try {
            const query = {
                bool: {
                    must: [],
                    should: [],
                    filter: []
                }
            };
    
            // Add search conditions based on query parameters
            if (title) query.bool.must.push({ match_phrase: { title } });
            if (description) query.bool.must.push({ match_phrase: { description } });
            if (channel) query.bool.must.push({ match: { channel } });
            if (category) query.bool.must.push({ match: { category } });
            
            // Handle country as an array
            if (Array.isArray(country) && country.length > 0) {
                country.forEach(c => {
                    query.bool.should.push({ match: { country: c } });
                });
                query.bool.minimum_should_match = 1;
            }
    
            if (product_promotion) query.bool.must.push({ match: { product_promotion } });
            if (duration) query.bool.must.push({ match: { duration } });
            if (published_at) query.bool.must.push({ match: { published_at } });
    
            // Handle language as an array
            if (Array.isArray(language) && language.length > 0) {
                language.forEach(lang => {
                    query.bool.should.push({ match_phrase: { language: lang } });
                });
                query.bool.minimum_should_match = 1;
            }
    
            // Handle followers range
            if (min_followers) query.bool.filter.push({ range: { followers: { gte: min_followers } } });
            if (max_followers) query.bool.filter.push({ range: { followers: { lte: max_followers } } });
    
            // Handle likes range
            if (min_likes) query.bool.filter.push({ range: { likes: { gte: min_likes } } });
            if (max_likes) query.bool.filter.push({ range: { likes: { lte: max_likes } } });
    
            // Handle views range
            if (min_views) query.bool.filter.push({ range: { views: { gte: min_views } } });
            if (max_views) query.bool.filter.push({ range: { views: { lte: max_views } } });
    
            // Handle comments range
            if (min_comments) query.bool.filter.push({ range: { comments: { gte: min_comments } } });
            if (max_comments) query.bool.filter.push({ range: { comments: { lte: max_comments } } });
    
            // Handle keyword search based on the 'search_by' parameter
            if (keyword) {
                if (search_by === 'title') {
                    query.bool.must.push({ match_phrase: { title: keyword } });
                } else if (search_by === 'description') {
                    query.bool.must.push({ match_phrase: { description: keyword } });
                } else if (search_by === 'both') {
                    query.bool.should.push({ match_phrase: { title: keyword } });
                    query.bool.should.push({ match_phrase: { description: keyword } });
                    query.bool.minimum_should_match = 1;
                }
            }
    
            const from = (page - 1) * size;
    
            // If no query parameters are provided, use match_all
            const finalQuery = query.bool.must.length || query.bool.should.length || query.bool.filter.length ? query : { match_all: {} };
    
            // Logging the final query for debugging purposes
            console.log('Elasticsearch Query:', JSON.stringify(finalQuery, null, 2));
    
            const body = await elasticClient.search({
                index: 'brand_videos',
                body: {
                    query: finalQuery,
                    from,
                    size,
                    track_total_hits: true
                }
            });
    
            const total = body.hits.total.value;
            const hits = body.hits.hits;
    
            res.status(200).json({ total, hits });
        } catch (error) {
            console.error("Error searching in Elasticsearch:", error);
            res.status(500).json({ error: 'Internal Server Error' });
        }
    },
    getChannelsfilter: async (req, res) => {
        const {
            custom_url,
            title,
            description,
            country = [], // Default to empty array if not provided
            min_subscribers,
            max_subscribers,
            min_videos,
            max_videos,
            min_views,
            max_views,
            published_at,
            updated_at,
            search_by = 'both', // Default to 'both' if not provided, options: 'title', 'description', 'both'
            keyword,
            page = 1, // Default to page 1 if not provided
            size = 70 // Default to 70 results per page if not provided
        } = req.body;
    
        try {
            const query = {
                bool: {
                    must: [],
                    should: [],
                    filter: []
                }
            };
    
            // Add search conditions based on query parameters
            if (custom_url) query.bool.must.push({ match_phrase: { "custom_url": custom_url } });
            if (title) query.bool.must.push({ match_phrase: { "title": title } });
            if (description) query.bool.must.push({ match_phrase: { "description": description } });
            
            // Handle country as an array
            if (Array.isArray(country) && country.length > 0) {
                country.forEach(c => {
                    query.bool.should.push({ match: { "country": c } });
                });
                query.bool.minimum_should_match = 1;
            }
    
            if (published_at) query.bool.must.push({ match: { "published_at": published_at } });
            if (updated_at) query.bool.must.push({ match: { "updated_at": updated_at } });
    
            // Handle subscribers range
            if (min_subscribers) query.bool.filter.push({ range: { subscribers: { gte: min_subscribers } } });
            if (max_subscribers) query.bool.filter.push({ range: { subscribers: { lte: max_subscribers } } });
    
            // Handle videos range
            if (min_videos) query.bool.filter.push({ range: { videos: { gte: min_videos } } });
            if (max_videos) query.bool.filter.push({ range: { videos: { lte: max_videos } } });
    
            // Handle views range
            if (min_views) query.bool.filter.push({ range: { views: { gte: min_views } } });
            if (max_views) query.bool.filter.push({ range: { views: { lte: max_views } } });
    
            // Handle keyword search based on the 'search_by' parameter
            if (keyword) {
                if (search_by === 'title') {
                    query.bool.must.push({ match_phrase: { title: keyword } });
                } else if (search_by === 'description') {
                    query.bool.must.push({ match_phrase: { description: keyword } });
                } else if (search_by === 'both') {
                    query.bool.should.push({ match_phrase: { title: keyword } });
                    query.bool.should.push({ match_phrase: { description: keyword } });
                    query.bool.minimum_should_match = 1;
                }
            }
    
            const from = (page - 1) * size;
    
            // If no query parameters are provided, use match_all
            const finalQuery = query.bool.must.length || query.bool.should.length || query.bool.filter.length ? query : { match_all: {} };
    
            // Logging the final query for debugging purposes
            console.log('Elasticsearch Query:', JSON.stringify(finalQuery, null, 2));
    
            const body = await elasticClient.search({
                index: 'channels',
                body: {
                    query: finalQuery,
                    from,
                    size,
                    track_total_hits: true
                }
            });
    
            const total = body.hits.total.value;
            const hits = body.hits.hits;
    
            res.status(200).json({ total, hits });
        } catch (error) {
            console.error("Error searching in Elasticsearch:", error);
            res.status(500).json({ error: 'Internal Server Error' });
        }
    },
    getProfile:async (req, res) => {
        const {
            channelId,
            page = 1, // Default to page 1 if not provided
            size = 60 // Default to 60 results per page if not provided
        } = req.query;
    
        try {
            // Step 1: Fetch the channel based on the channelId
            const channelResponse = await elasticClient.search({
                index: 'channels',
                body: {
                    query: {
                        term: { 
                            _id: channelId // Search based on the ID
                        }
                    }
                }
            });
    
            if (channelResponse.hits.total.value === 0) {
                return res.status(404).json({ message: 'Channel not found' });
            }
    
            const channel = channelResponse.hits.hits[0]._source;
    
            // Step 2: Fetch all videos based on the channel ID
            const videoResponse = await elasticClient.search({
                index: 'brand_videos',
                body: {
                    query: {
                        term: { 
                            channel: channelId // Search videos based on the channel ID
                        }
                    }
                }
            });
    
            let videos = videoResponse.hits.hits;
    
            // Step 3: Fetch additional details from YouTube API if no videos found
            let profilePhotoUrl = null;
            let language = 'Unknown';
            let categories = 'Unknown';
    
            if (videos.length === 0) {
                const channelDetails = await getChannelDetails(channelId);
                profilePhotoUrl = channelDetails.profilePhotoUrl;
                language = channelDetails.language;
                categories = channelDetails.categories;
    
                // Fetch videos from YouTube API
                const additionalVideosResponse = await axios.get('https://www.googleapis.com/youtube/v3/search', {
                    params: {
                        part: 'snippet',
                        channelId: channelId,
                        maxResults: size,
                        order: 'date',
                        key: "AIzaSyBfwrYn8M5SuRDAc29lBNdXvl2OXAsweDM"
                    }
                });
    
                videos = additionalVideosResponse.data.items.map(item => ({
                    title: item.snippet.title,
                    description: item.snippet.description,
                    url: `https://www.youtube.com/watch?v=${item.id.videoId}`,
                    publishedAt: item.snippet.publishedAt
                }));
            }
    
            // Step 4: Combine channel and video data into a single response object
            const result = {
                channel: {
                    ...channel,
                    profilePhotoUrl,
                    language,
                    categories
                },
                videos
            };
    
            res.status(200).json(result);
        } catch (error) {
            console.error("Error searching in Elasticsearch:", error);
            res.status(500).json({ error: 'Internal Server Error' });
        }
    }    
}