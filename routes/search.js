const express=require("express")
const router=express.Router()
const elasticController=require("../controller/searchSection")
const dataController=require("../controller/utils")



router.post("/Search",elasticController.searchApi);
router.post("/profileData",elasticController.fetchDetailedDataApi);

module.exports=router


