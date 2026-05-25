import { Router, type IRouter } from "express";
import healthRouter from "./health";
import openaiRouter from "./openai/index";
import storageRouter from "./storage";
import adsRouter from "./ads";

const router: IRouter = Router();

router.use(healthRouter);
router.use(storageRouter);
router.use(openaiRouter);
router.use(adsRouter);

export default router;
