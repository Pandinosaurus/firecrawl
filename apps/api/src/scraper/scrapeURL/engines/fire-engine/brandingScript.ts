import path from "node:path";
import fs from "node:fs";

export const loadBrandingScript = async () => {
  try {
    const filePath = path.join(__dirname, "scripts", "branding.js");
    const script = fs.readFileSync(filePath, "utf8");
    return script;
  } catch (error) {
    console.error("Error loading branding script", error);
    throw error;
  }
};
