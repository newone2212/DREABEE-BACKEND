const express=require("express")
const router=express.Router()
const elasticController=require("../controller/CompititorAnalysis")
const dataController=require("../controller/utils")



router.post("/Youtube/getFilterVedios",elasticController.getFilterVedios);
router.post("/Youtube/getFilterChannels",elasticController.getChannelsfilter);
router.get("/Youtube/getProfile",elasticController.getProfile);
module.exports=router


