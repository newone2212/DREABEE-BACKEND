const express=require("express")
const router=express.Router()
const elasticController=require("../controller/brandSection")
const dataController=require("../controller/utils")
router.get('/Youtube/brand_videos', elasticController.deft);
router.post('/Youtube/search',elasticController.search)
router.post("/Youtube/ExactSearch",elasticController.exactMAtch)

// API endpoint to generate random male-female ratio and age group distribution data
router.get('/Youtube/generate-data', (req, res) => {
    try {
        const totalPeople = parseInt(req.query.totalPeople) || 1000; // Default total people count is 1000
        const maleRatio = parseFloat(req.query.maleRatio) || 0.5; // Default male-female ratio is 0.5
        const maleFemaleData = dataController.generateMaleFemaleData(totalPeople, maleRatio);
        const ageGroupData = dataController.generateAgeGroupData(totalPeople);
        
        res.status(200).json({ maleFemaleData, ageGroupData });
    } catch (error) {
        console.error("Error generating data:", error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

router.post('/Youtube/process-channel-data',elasticController.generate);
router.post("/Youtube/search2",elasticController.searchBrand)
//use it for dedicated and chech url
router.post("/Youtube/DedicatedVedios",elasticController.sentimentalAnalysisApi)
router.post("/Youtube/InetgratedVedios",elasticController.searchBrandIntegrated)
router.get("/Youtube/BrandData",elasticController.Brands_sugesstion)
router.post("/Youtube/AddMentionsData",elasticController.GetMentionGraph)
router.get("/Youtube/BrandByID/:id",elasticController.brands_details)
router.get("/Youtube/BrandByYOUTUBEName/:id",elasticController.brands_yt_details)
router.get("/Youtube/GetYoutubeBrands",elasticController.GetYoutubeBrands)
router.get("/Youtube/GetInfluencerBrands",elasticController.GetInfluencerBrands)
router.post("/Youtube/newone",elasticController.NewOne)
router.get("/Youtube/update",elasticController.updateit)
router.get("/Youtube/GetAllBrands",elasticController.getBrandDetailes)
router.get("/Youtube/GetAllBrandsByCalculations/:id",elasticController.brands_Calculation)
router.post("/Youtube/CompitiorData",elasticController.getBrandVideoStats)
router.post("/Youtube/CompitiorAverageData",elasticController.getBrandVideoAverageStats)
router.get("/Youtube/GetChannelLAnguage/:id",elasticController.getChannelLanguage)
router.post("/Youtube/profilephoto",elasticController.getProfilePhoto)
router.post('/Youtube/age-gender', elasticController.getUniqueChannelIds);
router.get("/Youtube/Brandprofile/:keyword",elasticController.getBrandProfile)
router.get("/cities_distribution",elasticController.cities_distribution)
module.exports=router