import { Router, type IRouter } from "express";
import healthRouter from "./health";
import meRouter from "./me";
import openaiRouter from "./openai/index";
import storageRouter from "./storage";
import publicLandingRouter from "./public-landing";
import adsRouter from "./ads";
import seoRouter from "./seo";
import adminRouter from "./admin";
import meExtrasRouter from "./me-extras";
import linkedinRouter, { publicLinkedinRouter } from "./linkedin";
import emailRouter from "./email";
import webhooksRouter from "./webhooks";
import { requireAuth, requireAdmin } from "../middlewares/auth";

const router: IRouter = Router();

// Public (no auth)
router.use(healthRouter);
router.use(storageRouter);
router.use(publicLandingRouter);
router.use(publicLinkedinRouter);
router.use(webhooksRouter);

// Authenticated (any signed-in user can read their own profile)
router.use(meRouter);

// Open beta — any authenticated user can access app features.
router.use(requireAuth);
router.use(openaiRouter);
router.use(adsRouter);
router.use(seoRouter);
router.use(meExtrasRouter);
router.use(linkedinRouter);
router.use(emailRouter);

// Admin-only routes (CRM)
router.use(requireAdmin, adminRouter);

export default router;
