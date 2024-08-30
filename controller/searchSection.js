const elasticClient = require('../db/conn');
const searchApi = async (req, res) => {
    try {
        const { platform, type, custom_url, title, keyword, page = 1, size = 60, country = [] } = req.body;
        
        const from = (page - 1) * size;
        const query = { bool: { must: [], should: [], filter: [] } };

        if (platform === 'instagram') {
            // Instagram specific fields
            const { username, is_verified, min_follower_count, max_follower_count, min_er, max_er, min_likes, max_likes, language = [], min_price, max_price, last_post_published_at, created_at } = req.body;

            if (keyword) {
                query.bool.should.push({ match_phrase: { "name": keyword } });
                query.bool.should.push({ match_phrase: { "username": keyword } });
                query.bool.minimum_should_match = 1;
            }
            if (title) query.bool.must.push({ match_phrase: { "name": title } });
            
            // Handle country as an array
            if (Array.isArray(country) && country.length > 0) {
                country.forEach(c => {
                    query.bool.should.push({ match: { "country": c } });
                });
                query.bool.minimum_should_match = 1;
            }

            if (username) query.bool.must.push({ match_phrase: { "username": username } });
            if (is_verified) query.bool.must.push({ match: { "is_verified": is_verified } });

            // Handle follower count range
            if (min_follower_count) query.bool.filter.push({ range: { "follower_count": { gte: min_follower_count } } });
            if (max_follower_count) query.bool.filter.push({ range: { "follower_count": { lte: max_follower_count } } });

            // Handle engagement rate range
            if (min_er) query.bool.filter.push({ range: { "er": { gte: min_er } } });
            if (max_er) query.bool.filter.push({ range: { "er": { lte: max_er } } });

            // Handle likes range
            if (min_likes) query.bool.filter.push({ range: { "likes": { gte: min_likes } } });
            if (max_likes) query.bool.filter.push({ range: { "likes": { lte: max_likes } } });

            // Handle language as an array
            if (Array.isArray(language) && language.length > 0) {
                language.forEach(lang => {
                    query.bool.should.push({ match_phrase: { "language": lang } });
                });
                query.bool.minimum_should_match = 1;
            }

            // Handle price range
            if (min_price) query.bool.filter.push({ range: { "price_min": { gte: min_price } } });
            if (max_price) query.bool.filter.push({ range: { "price_max": { lte: max_price } } });

            if (last_post_published_at) query.bool.must.push({ range: { "last_post_published_at": { gte: last_post_published_at } } });
            if (created_at) query.bool.must.push({ range: { "created_at": { gte: created_at } } });

            // If no query parameters are provided, use match_all
            const finalQuery = query.bool.must.length || query.bool.should.length || query.bool.filter.length ? query : { match_all: {} };

            console.log('Elasticsearch Query:', JSON.stringify(finalQuery, null, 2));

            const body = await elasticClient.search({
                index: 'insta_users',
                body: {
                    query: finalQuery,
                    from,
                    size,
                    track_total_hits: true
                }
            });

            const total = body.hits.total.value;
            const hits = body.hits.hits;

            return res.status(200).json({ total, hits });

        } else if (platform === 'youtube' && type === 'video') {
            const { language = [], product_promotion, min_duration, max_duration, min_likes, max_likes, min_comments, max_comments, videoType, published_at, updated_at, views } = req.body;

            // Add search conditions based on query parameters
            if (keyword) {
                query.bool.should.push({ match_phrase: { "description": keyword } });
                query.bool.should.push({ match_phrase: { "title": keyword } });
                query.bool.minimum_should_match = 1;
            }
            if (title) query.bool.must.push({ match_phrase: { "title": title } });
            
            // Handle country as an array
            if (Array.isArray(country) && country.length > 0) {
                country.forEach(c => {
                    query.bool.should.push({ match: { "country": c } });
                });
                query.bool.minimum_should_match = 1;
            }

            // Handle language as an array
            if (Array.isArray(language) && language.length > 0) {
                language.forEach(lang => {
                    query.bool.should.push({ match_phrase: { "language": lang } });
                });
                query.bool.minimum_should_match = 1;
            }

            if (product_promotion) query.bool.must.push({ match: { "product_promotion": product_promotion } });

            // Handle duration range
            if (min_duration) query.bool.filter.push({ range: { "duration": { gte: min_duration } } });
            if (max_duration) query.bool.filter.push({ range: { "duration": { lte: max_duration } } });

            if (published_at) query.bool.must.push({ range: { "published_at": { gte: published_at } } });
            if (updated_at) query.bool.must.push({ range: { "updated_at": { gte: updated_at } } });

            // Handle likes range
            if (min_likes) query.bool.filter.push({ range: { "likes": { gte: min_likes } } });
            if (max_likes) query.bool.filter.push({ range: { "likes": { lte: max_likes } } });

            // Handle views range
            if (views) query.bool.must.push({ match: { "views": views } });

            // Handle comments range
            if (min_comments) query.bool.filter.push({ range: { "comments": { gte: min_comments } } });
            if (max_comments) query.bool.filter.push({ range: { "comments": { lte: max_comments } } });

            if (videoType === 'short') {
                query.bool.must.push({
                    range: {
                        duration: { lte: "00:01:00" }
                    }
                });
            } else if (videoType === 'video') {
                query.bool.must.push({
                    range: {
                        duration: { gt: "00:01:00" }
                    }
                });
            }

            // If no query parameters are provided, use match_all
            const finalQuery = query.bool.must.length || query.bool.should.length || query.bool.filter.length ? query : { match_all: {} };

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
            const hits = body.hits.hits.map(hit => {
                const videoType = hit._source.duration <= "00:01:00" ? "short" : "video";
                return {
                    ...hit,
                    _source: {
                        ...hit._source,
                        videoType
                    }
                };
            });

            return res.status(200).json({ total, hits });

        } else if (platform === 'youtube' && type === 'channel') {
            const { min_subscribers, max_subscribers, min_videos, max_videos, min_views, max_views, published_at, updated_at } = req.body;

            if (keyword) {
                query.bool.should.push({ match_phrase: { "description": keyword } });
                query.bool.should.push({ match_phrase: { "title": keyword } });
                query.bool.minimum_should_match = 1;
            }
            if (custom_url) query.bool.must.push({ match_phrase: { "custom_url": custom_url } });
            if (title) query.bool.must.push({ match_phrase: { "title": title } });
            
            // Handle country as an array
            if (Array.isArray(country) && country.length > 0) {
                country.forEach(c => {
                    query.bool.should.push({ match: { "country": c } });
                });
                query.bool.minimum_should_match = 1;
            }

            // Handle subscribers range
            if (min_subscribers) query.bool.filter.push({ range: { subscribers: { gte: min_subscribers } } });
            if (max_subscribers) query.bool.filter.push({ range: { subscribers: { lte: max_subscribers } } });

            // Handle videos range
            if (min_videos) query.bool.filter.push({ range: { videos: { gte: min_videos } } });
            if (max_videos) query.bool.filter.push({ range: { videos: { lte: max_videos } } });

            // Handle views range
            if (min_views) query.bool.filter.push({ range: { views: { gte: min_views } } });
            if (max_views) query.bool.filter.push({ range: { views: { lte: max_views } } });

            if (published_at) query.bool.must.push({ range: { "published_at": { gte: published_at } } });
            if (updated_at) query.bool.must.push({ range: { "updated_at": { gte: updated_at } } });

            // If no query parameters are provided, use match_all
            const finalQuery = query.bool.must.length || query.bool.should.length || query.bool.filter.length ? query : { match_all: {} };

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

            return res.status(200).json({ total, hits });
        } else {
            return res.status(400).json({ error: 'Invalid platform or type provided' });
        }
    } catch (error) {
        console.error("Error searching in Elasticsearch:", error);
        return res.status(500).json({ error: 'Internal Server Error' });
    }
};
const fetchAllVideos = async (index, query) => {
    const allVideos = [];
    const scrollTimeout = '2m';

    let response = await elasticClient.search({
        index,
        body: {
            query,
            size: 1000
        },
        scroll: scrollTimeout
    });

    let scrollId = response._scroll_id;
    let hits = response.hits.hits;

    while (hits.length > 0) {
        allVideos.push(...hits.map(hit => hit._source));
        response = await elasticClient.scroll({
            scroll_id: scrollId,
            scroll: scrollTimeout
        });

        scrollId = response._scroll_id;
        hits = response.hits.hits;
    }

    await elasticClient.clearScroll({
        scroll_id: scrollId
    });

    return allVideos;
};

// API to fetch detailed data for Instagram or YouTube based on ID
const fetchDetailedDataApi = async (req, res) => {
    try {
        const { id, platform } = req.body;

        if (!id || !platform) {
            return res.status(400).json({ error: 'ID and platform must be provided' });
        }

        let query = { bool: { must: [] } };
        let index;

        if (platform === 'instagram') {
            query.bool.must.push({ match: { "username": id } });
            index = 'insta_users';
        } else if (platform === 'youtube') {
            query.bool.must.push({ match: { "custom_url": id } });
            index = 'channels';
        } else {
            return res.status(400).json({ error: 'Invalid platform specified' });
        }

        const body = await elasticClient.search({
            index,
            body: {
                query,
                size: 1
            }
        });

        if (body.hits.total.value === 0) {
            return res.status(404).json({ error: 'No data found for the provided ID' });
        }

        const data = body.hits.hits[0]._source;
                
        let responseData = {};

        if (platform === 'instagram') {
            responseData = {
                profile: {
                    username: data.username,
                    name: data.name || "N/A",
                    avatar: data.avatar,
                    is_verified: data.is_verified,
                    subscriber_count: data.follower_count,
                    avg_likes: data.likes || 0,
                    avg_comments: data.scores_comments || 0, 
                    short_views: data.short_views || 0, 
                    er: data.er,
                },
                database_score: {
                    total_score: data.scores_general || 0,
                },
                popular_videos: [], 
                followers_by_month: [], 
                following_by_month: [], 
                video_engagement_likes: [], 
                video_engagement_comments: [], 
                most_used_hashtags: data.hashtags || [], 
                insights: {
                    top_content_categories: data.content_categories || [], 
                    audience_demographics: {
                        gender: data.audience_gender || [], 
                        age: data.audience_age || [] 
                    },
                    watch_time_from_subscribers: {
                        subscribed: data.watch_time_subscribed || 0, 
                        not_subscribed: data.watch_time_not_subscribed || 0 
                    },
                    audience_location: {
                        country: data.audience_country || [], 
                        city: data.audience_city || [] 
                    }
                },
                growth_statistics: {
                    total_views_last_30_days: data.total_views_last_30_days || 0, 
                    total_videos_posted: data.total_videos_posted || 0 
                },
                brands_and_sponsored_posts: {
                    associated_brands: data.brands || [], 
                    sponsored_posts: data.sponsored_posts || [] 
                }
            };

        } else if (platform === 'youtube') {
            responseData = {
                profile: {
                    custom_url: data.custom_url,
                    title: data.title,
                    description: data.description,
                    country: data.country,
                    subscribers: data.subscribers,
                    videos: data.videos,
                    views: data.views,
                    published_at: data.published_at,
                    updated_at: data.updated_at
                },
                videos: [], 
                total_views: 0,
                total_likes: 0,
                total_comments: 0,
                total_engagement_rate: 0,
                avg_likes_per_video: 0,
                avg_comments_per_video: 0,
                monthly_statistics: {}
            };
            const Yt_id=body.hits.hits[0]._id;
            console.log(Yt_id)
            // Fetch all video details for YouTube using the channel ID
            const videoQuery = {
                bool: { must: [{ match: { channel: Yt_id } }] } // Use the YouTube channel ID
            };

            const videos = await fetchAllVideos('brand_videos', videoQuery);

            let totalLikes = 0, totalComments = 0, totalViews = 0;
            let engagementRate = 0;
            let monthlyStats = {};

            videos.forEach(video => {
                const videoLikes = parseInt(video.likes || 0);
                const videoComments = parseInt(video.comments || 0);
                const videoViews = parseInt(video.views || 0);
                totalLikes += videoLikes;
                totalComments += videoComments;
                totalViews += videoViews;

                if (videoViews > 0) {
                    engagementRate += ((videoLikes + videoComments) / videoViews) * 100;
                }

                const month = new Date(video.published_at).toISOString().substring(0, 7);

                if (!monthlyStats[month]) {
                    monthlyStats[month] = {
                        total_videos: 0,
                        total_views: 0,
                        total_likes: 0,
                        total_comments: 0
                    };
                }

                monthlyStats[month].total_videos += 1;
                monthlyStats[month].total_views += videoViews;
                monthlyStats[month].total_likes += videoLikes;
                monthlyStats[month].total_comments += videoComments;
            });

            responseData.total_views = totalViews;
            responseData.total_likes = totalLikes;
            responseData.total_comments = totalComments;
            responseData.total_engagement_rate = videos.length > 0 ? engagementRate / videos.length : 0;
            responseData.avg_likes_per_video = videos.length > 0 ? totalLikes / videos.length : 0;
            responseData.avg_comments_per_video = videos.length > 0 ? totalComments / videos.length : 0;

            responseData.videos = videos;
            responseData.monthly_statistics = monthlyStats;
        }

        return res.status(200).json({ data: responseData });

    } catch (error) {
        console.error("Error fetching data from Elasticsearch:", error);
        return res.status(500).json({ error: 'Internal Server Error' });
    }
};

module.exports = { searchApi ,fetchDetailedDataApi};
