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
import facebookRouter, { publicFacebookRouter } from "./facebook-oauth";
import googleRouter, { publicGoogleRouter } from "./google-oauth";
import integrationsRouter from "./integrations";
import manualIntegrationsRouter from "./manual-integrations";
import emailRouter, { publicEmailRouter } from "./email";
import webhooksRouter from "./webhooks";
import contactRouter from "./contact";
import { requireAuth, requireAdmin } from "../middlewares/auth";

const router: IRouter = Router();

// Public (no auth)
router.use(healthRouter);
router.use(storageRouter);
router.use(publicLandingRouter);
router.use(publicLinkedinRouter);
router.use(publicFacebookRouter);
router.use(publicGoogleRouter);
router.use(webhooksRouter);
router.use(contactRouter);
router.use(publicEmailRouter);

// Authenticated (any signed-in user can read their own profile)
router.use(meRouter);

// Open beta — any authenticated user can access app features.
router.use(requireAuth);
router.use(openaiRouter);
router.use(adsRouter);
router.use(seoRouter);
router.use(meExtrasRouter);
router.use(linkedinRouter);
router.use(facebookRouter);
router.use(googleRouter);
router.use(integrationsRouter);
router.use(manualIntegrationsRouter);
router.use(emailRouter);

// Admin-only routes (CRM)
router.use(requireAdmin, adminRouter);

export default router;
