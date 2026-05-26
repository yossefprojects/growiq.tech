import { Router, type IRouter } from "express";
import { requireAuth, type AuthedRequest } from "../middlewares/auth";

const router: IRouter = Router();

router.get("/me", requireAuth, (req, res) => {
  const r = req as AuthedRequest;
  res.json({
    userId: r.userId,
    email: r.userEmail,
    isAdmin: r.isAdmin,
  });
});

export default router;
