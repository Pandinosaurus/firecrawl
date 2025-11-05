import { processRawBranding } from "./processor";
import { BrandingProfile } from "../../types/branding";
import { enhanceBrandingWithLLM } from "./llm";
import { Meta } from "../../scraper/scrapeURL";
import { Document } from "../../controllers/v2/types";
import { BrandingScriptReturn, ButtonSnapshot } from "./types";
import { mergeBrandingResults } from "./merge";

export async function brandingTransformer(
  meta: Meta,
  document: Document,
  rawBranding: BrandingScriptReturn,
): Promise<BrandingProfile> {
  let jsBranding = processRawBranding(rawBranding);

  if (!jsBranding) {
    return {};
  }

  let brandingProfile: BrandingProfile = jsBranding;

  try {
    meta.logger.info("Enhancing branding with LLM...");

    const buttonSnapshots: ButtonSnapshot[] =
      (jsBranding as any).__button_snapshots || [];

    const logoCandidates = rawBranding.logoCandidates || [];
    const brandName = rawBranding.brandName;

    meta.logger.info(
      `Sending ${buttonSnapshots.length} buttons and ${logoCandidates.length} logo candidates to LLM for classification`,
    );

    const llmEnhancement = await enhanceBrandingWithLLM({
      jsAnalysis: jsBranding,
      buttons: buttonSnapshots,
      logoCandidates: logoCandidates.length > 0 ? logoCandidates : undefined,
      brandName,
      screenshot: document.screenshot,
      url: document.url || meta.url,
    });

    meta.logger.info("LLM enhancement complete", {
      primary_btn_index: llmEnhancement.buttonClassification.primaryButtonIndex,
      secondary_btn_index:
        llmEnhancement.buttonClassification.secondaryButtonIndex,
      button_confidence: llmEnhancement.buttonClassification.confidence,
      color_confidence: llmEnhancement.colorRoles.confidence,
      logo_selected_index: llmEnhancement.logoSelection?.selectedLogoIndex,
      logo_confidence: llmEnhancement.logoSelection?.confidence,
    });

    brandingProfile = mergeBrandingResults(
      jsBranding,
      llmEnhancement,
      buttonSnapshots,
      logoCandidates.length > 0 ? logoCandidates : undefined,
    );
  } catch (error) {
    meta.logger.error(
      "LLM branding enhancement failed, using JS analysis only",
      { error },
    );
    brandingProfile = jsBranding;
  }

  if (process.env.DEBUG_BRANDING !== "true") {
    delete (brandingProfile as any).__button_snapshots;
  }

  return brandingProfile;
}
