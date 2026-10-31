import express from "express";
import { publicLibraryTerms, publicLibraryTerm } from "../controllers/libraryController.js";
const router = express.Router();
router.get("/:kind", publicLibraryTerms);
router.get("/:kind/entry", publicLibraryTerm);
router.get("/:kind/:slug", publicLibraryTerm);
export default router;
