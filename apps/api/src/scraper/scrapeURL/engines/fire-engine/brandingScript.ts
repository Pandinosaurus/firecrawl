/**
 * Browser script for extracting branding information from web pages.
 * This script is injected and executed in the page context.
 */

export const brandingScript = `
/**
 * Extracts brand design elements from the page.
 * This script is executed in the page context using \`await page.evaluate(() => { ... });\`.
 
 * @returns {Promise<BrandDesign>} A promise that resolves to the brand design elements.
 */
(async function __extractBrandDesign() {
  const clamp = (n, min, max) => Math.max(min, Math.min(max, n));
  const toPx = v => {
    if (!v || v === "auto") return null;
    if (v.endsWith("px")) return parseFloat(v);
    if (v.endsWith("rem"))
      return (
        parseFloat(v) *
        parseFloat(getComputedStyle(document.documentElement).fontSize || 16)
      );
    if (v.endsWith("em"))
      return (
        parseFloat(v) *
        parseFloat(getComputedStyle(document.body).fontSize || 16)
      );
    if (v.endsWith("%")) return null;
    const num = parseFloat(v);
    return Number.isFinite(num) ? num : null;
  };

  const dedupe = arr => Array.from(new Set(arr.filter(Boolean)));

  // Font cleaning moved to LLM for better intelligence

  // Resolves CSS variables in SVG elements by replacing them with computed values
  const resolveSvgStyles = svg => {
    const originalElements = [svg, ...svg.querySelectorAll("*")];
    const computedStyles = originalElements.map(el => ({
      el,
      computed: getComputedStyle(el),
    }));

    const clone = svg.cloneNode(true);
    const clonedElements = [clone, ...clone.querySelectorAll("*")];

    const svgDefaults = {
      fill: "rgb(0, 0, 0)",
      stroke: "none",
      "stroke-width": "1px",
      opacity: "1",
      "fill-opacity": "1",
      "stroke-opacity": "1",
    };

    // Helper to apply resolved styles for properties with CSS variables
    const applyResolvedStyle = (clonedEl, originalEl, computed, prop) => {
      const attrValue = originalEl.getAttribute(prop);
      const value = computed.getPropertyValue(prop);

      if (attrValue && attrValue.includes("var(")) {
        clonedEl.removeAttribute(prop);
        if (value && value.trim() && value !== "none") {
          clonedEl.style.setProperty(prop, value, "important");
        }
      } else if (value && value.trim()) {
        // Only apply non-default values
        const isExplicit =
          originalEl.hasAttribute(prop) || originalEl.style[prop];
        const isDifferent =
          svgDefaults[prop] !== undefined && value !== svgDefaults[prop];
        if (isExplicit || isDifferent) {
          clonedEl.style.setProperty(prop, value, "important");
        }
      }
    };

    for (let i = 0; i < clonedElements.length; i++) {
      const clonedEl = clonedElements[i];
      const originalEl = originalElements[i];
      const computed = computedStyles[i]?.computed;
      if (!computed) continue;

      // Apply all relevant SVG properties
      const allProps = [
        "fill",
        "stroke",
        "color",
        "stop-color",
        "flood-color",
        "lighting-color",
        "stroke-width",
        "stroke-dasharray",
        "stroke-dashoffset",
        "stroke-linecap",
        "stroke-linejoin",
        "opacity",
        "fill-opacity",
        "stroke-opacity",
      ];

      for (const prop of allProps) {
        applyResolvedStyle(clonedEl, originalEl, computed, prop);
      }
    }

    return clone;
  };

  const hexify = rgba => {
    if (!rgba) return null;
    if (/^#([0-9a-f]{3,8})$/i.test(rgba)) {
      if (rgba.length === 4) {
        return (
          "#" +
          [...rgba.slice(1)]
            .map(ch => ch + ch)
            .join("")
            .toUpperCase()
        );
      }
      if (rgba.length === 7) return rgba.toUpperCase();
      if (rgba.length === 9) return rgba.slice(0, 7).toUpperCase();
      return rgba.toUpperCase();
    }

    // Try parsing Display P3 or other color() formats with alpha
    const colorMatchWithAlpha = rgba.match(
      /color\\((?:display-p3|srgb)\\s+([\\d.]+)\\s+([\\d.]+)\\s+([\\d.]+)\\s*\\/\\s*([\\d.]+)/i,
    );
    if (colorMatchWithAlpha) {
      const [r, g, b, a] = colorMatchWithAlpha
        .slice(1, 5)
        .map(n => parseFloat(n));
      const rgb = [r, g, b].map(n => clamp(Math.round(n * 255), 0, 255));
      return \`rgba(\${rgb[0]}, \${rgb[1]}, \${rgb[2]}, \${a.toFixed(2)})\`;
    }

    // Try parsing Display P3 or other color() formats without alpha
    const colorMatch = rgba.match(
      /color\\((?:display-p3|srgb)\\s+([\\d.]+)\\s+([\\d.]+)\\s+([\\d.]+)/i,
    );
    if (colorMatch) {
      const [r, g, b] = colorMatch
        .slice(1, 4)
        .map(n => clamp(Math.round(parseFloat(n) * 255), 0, 255));
      return (
        "#" +
        [r, g, b]
          .map(x => x.toString(16).padStart(2, "0"))
          .join("")
          .toUpperCase()
      );
    }

    // Try direct parsing for rgba() format with alpha
    const rgbaMatch = rgba.match(
      /^rgba?\\((\\d+),\\s*(\\d+),\\s*(\\d+),\\s*([\\d.]+)/i,
    );
    if (rgbaMatch) {
      const [r, g, b, a] = rgbaMatch.slice(1, 5);
      return \`rgba(\${r}, \${g}, \${b}, \${parseFloat(a).toFixed(2)})\`;
    }

    // Try direct parsing for rgb() format
    const directMatch = rgba.match(/^rgba?\\((\\d+),\\s*(\\d+),\\s*(\\d+)/i);
    if (directMatch) {
      const [r, g, b] = directMatch
        .slice(1, 4)
        .map(n => clamp(parseInt(n, 10), 0, 255));
      return (
        "#" +
        [r, g, b]
          .map(x => x.toString(16).padStart(2, "0"))
          .join("")
          .toUpperCase()
      );
    }

    // Fallback to canvas method for named colors
    const ctx = document.createElement("canvas").getContext("2d");
    if (!ctx) return null;
    ctx.fillStyle = rgba;
    const val = ctx.fillStyle;
    const m = val.match(/^rgba?\\((\\d+),\\s*(\\d+),\\s*(\\d+)/i);
    if (!m) return null;
    const [r, g, b] = m.slice(1, 4).map(n => clamp(parseInt(n, 10), 0, 255));
    return (
      "#" +
      [r, g, b]
        .map(x => x.toString(16).padStart(2, "0"))
        .join("")
        .toUpperCase()
    );
  };

  const contrastYIQ = hex => {
    if (!hex) return 0;
    const h = hex.replace("#", "");
    if (h.length < 6) return 0;
    const r = parseInt(h.slice(0, 2), 16),
      g = parseInt(h.slice(2, 4), 16),
      b = parseInt(h.slice(4, 6), 16);
    return (r * 299 + g * 587 + b * 114) / 1000;
  };

  const isColorValid = color => {
    if (!color) return false;

    // Handle rgba() format
    if (color.startsWith("rgba(") || color.startsWith("rgb(")) {
      // Reject fully transparent colors (alpha = 0)
      const match = color.match(/rgba?\\([^,]+,[^,]+,[^,]+(?:,\\s*([0-9.]+))?\\)/);
      if (match && match[1] !== undefined) {
        const alpha = parseFloat(match[1]);
        if (alpha === 0 || alpha < 0.01) return false; // Transparent
      }
      // Also check if it's literally transparent
      if (color.includes("0, 0, 0, 0") || color.includes("0,0,0,0"))
        return false;
      return true; // Accept all other rgba/rgb colors
    }

    // Handle hex colors
    if (/^#(FFF(FFF)?|000(000)?|F{6}|0{6})$/i.test(color)) return false;
    const yiq = contrastYIQ(color);
    return yiq < 240;
  };

  const collectCSSData = () => {
    const data = {
      cssVars: {},
      colors: [],
      radii: [],
      spacings: [],
    };

    const pushColor = c => {
      const h = hexify(c);
      if (h) data.colors.push(h);
    };

    for (const sheet of Array.from(document.styleSheets)) {
      let rules;
      try {
        rules = sheet.cssRules;
      } catch (e) {
        continue;
      }
      if (!rules) continue;

      for (const rule of Array.from(rules)) {
        try {
          if (rule.type === CSSRule.STYLE_RULE) {
            const s = rule.style;
            for (const name of Array.from(s)) {
              if (name.startsWith("--")) {
                data.cssVars[name] = s.getPropertyValue(name).trim();
                pushColor(data.cssVars[name]);
              }
            }
            [
              "color",
              "background-color",
              "border-color",
              "fill",
              "stroke",
            ].forEach(prop => pushColor(s.getPropertyValue(prop)));
            [
              "border-radius",
              "border-top-left-radius",
              "border-top-right-radius",
              "border-bottom-left-radius",
              "border-bottom-right-radius",
            ].forEach(p => {
              const v = toPx(s.getPropertyValue(p));
              if (v) data.radii.push(v);
            });
            [
              "margin",
              "margin-top",
              "margin-right",
              "margin-bottom",
              "margin-left",
              "padding",
              "padding-top",
              "padding-right",
              "padding-bottom",
              "padding-left",
              "gap",
              "row-gap",
              "column-gap",
            ].forEach(p => {
              const v = toPx(s.getPropertyValue(p));
              if (v) data.spacings.push(v);
            });
          }
          // Skip @font-face rules - we get fonts from rendered elements instead
        } catch {}
      }
    }

    return data;
  };

  const sampleElements = () => {
    const picks = [];
    const pushQ = (q, limit = 10) => {
      for (const el of Array.from(document.querySelectorAll(q)).slice(0, limit))
        picks.push(el);
    };
    pushQ('header img, .site-logo img, img[alt*=logo i], img[src*="logo"]', 5);
    // Increase button limit and add selectors for links styled as buttons
    // Include: buttons, role=button, a.button, a.btn, anything with "btn" in class,
    // and links with common button-like classes (bg-brand, bg-primary, bg-accent, etc.)
    pushQ(
      'button, [role=button], a.button, a.btn, [class*="btn"], a[class*="bg-brand"], a[class*="bg-primary"], a[class*="bg-accent"], a[class*="-button"]',
      50,
    );
    pushQ('input, select, textarea, [class*="form-control"]', 25);
    pushQ("h1, h2, h3, p, a", 50);
    return dedupe(picks);
  };

  const getStyleSnapshot = el => {
    const cs = getComputedStyle(el);
    const rect = el.getBoundingClientRect();

    const colorRaw = cs.getPropertyValue("color");
    const bgRaw = cs.getPropertyValue("background-color");
    const bcRaw = cs.getPropertyValue("border-top-color");
    const borderWidth = toPx(cs.getPropertyValue("border-top-width"));

    const color = hexify(colorRaw);
    const bg = hexify(bgRaw);
    const bc = hexify(bcRaw);
    const radius = toPx(cs.getPropertyValue("border-radius"));
    const fw = parseInt(cs.getPropertyValue("font-weight"), 10) || null;
    // Get full font stack (including fallbacks) for better context
    const fontStack = cs
      .getPropertyValue("font-family")
      ?.split(",")
      .map(f => f.replace(/["']/g, "").trim())
      .filter(Boolean) || [];
    const ff = fontStack[0] || null; // Primary font for backward compatibility
    const fs = cs.getPropertyValue("font-size");

    // Get class names - ALWAYS use getAttribute as it's most reliable
    let classNames = "";
    try {
      // Try getAttribute first (most reliable)
      if (el.getAttribute) {
        const attrClass = el.getAttribute("class");
        if (attrClass) {
          classNames = attrClass.toLowerCase();
        }
      }

      // Only fallback to className property if getAttribute failed
      if (!classNames && el.className) {
        if (typeof el.className === "string") {
          classNames = el.className.toLowerCase();
        } else if (el.className.baseVal) {
          // SVG elements have className.baseVal
          classNames = el.className.baseVal.toLowerCase();
        }
      }
    } catch (e) {
      // Last resort fallback
      try {
        if (el.className && typeof el.className === "string") {
          classNames = el.className.toLowerCase();
        }
      } catch (e2) {
        classNames = "";
      }
    }

    return {
      tag: el.tagName.toLowerCase(),
      classNames,
      text: (el.textContent && el.textContent.trim().substring(0, 100)) || "", // Add text content
      rect: { w: rect.width, h: rect.height },
      colors: { text: color, background: bg, border: bc, borderWidth },
      typography: { family: ff, fontStack, size: fs || null, weight: fw }, // Include full font stack
      radius,
      isButton: el.matches(
        'button,[role=button],a.button,a.btn,[class*="btn"],a[class*="bg-brand"],a[class*="bg-primary"],a[class*="bg-accent"],a[class*="-button"]',
      ),
      isInput: el.matches('input,select,textarea,[class*="form-control"]'),
      isLink: el.matches("a"),
    };
  };

  const findImages = () => {
    const imgs = [];
    const push = (src, type) => {
      if (src) imgs.push({ type, src });
    };

    push(document.querySelector('link[rel*="icon" i]')?.href, "favicon");
    push(document.querySelector('meta[property="og:image" i]')?.content, "og");
    push(
      document.querySelector('meta[name="twitter:image" i]')?.content,
      "twitter",
    );

    // PRIORITY 1: Look for img or svg inside a link inside header/nav
    const headerLinkImg = document.querySelector(
      'header a img, header a svg, nav a img, nav a svg, [role="banner"] a img, [role="banner"] a svg, .header a img, .header a svg',
    );

    if (headerLinkImg) {
      if (headerLinkImg.tagName.toLowerCase() === "svg") {
        const resolvedSvg = resolveSvgStyles(headerLinkImg);
        const serializer = new XMLSerializer();
        const svgStr =
          "data:image/svg+xml;utf8," +
          encodeURIComponent(serializer.serializeToString(resolvedSvg));
        push(svgStr, "logo-svg");
      } else {
        push(headerLinkImg.src, "logo");
      }
    } else {
      // PRIORITY 2: Find logo images with "logo" in alt/src/container
      const logoImgCandidates = Array.from(document.images)
        .filter(
          img =>
            /logo/i.test(img.alt || "") ||
            /logo/i.test(img.src) ||
            img.closest('[class*="logo"]'),
        )
        .filter(
          img =>
            !img.closest(
              '[class*="testimonial"], [class*="client"], [class*="partner"]',
            ),
        );

      const logoImg = logoImgCandidates.reduce((best, img) => {
        if (!best) return img;
        const imgInHeader = img.closest('header, nav, [role="banner"]');
        const bestInHeader = best.closest('header, nav, [role="banner"]');
        if (imgInHeader && !bestInHeader) return img;
        if (!imgInHeader && bestInHeader) return best;
        const imgRect = img.getBoundingClientRect();
        const bestRect = best.getBoundingClientRect();
        return imgRect.top < bestRect.top ? img : best;
      }, null);

      if (logoImg) push(logoImg.src, "logo");

      // PRIORITY 3: Find SVG logo
      const svgLogoCandidates = Array.from(document.querySelectorAll("svg"))
        .filter(
          s => /logo/i.test(s.id) || /logo/i.test(s.className?.baseVal || ""),
        )
        .filter(
          svg =>
            !svg.closest(
              '[class*="testimonial"], [class*="client"], [class*="partner"]',
            ),
        );

      const svgLogo = svgLogoCandidates.reduce((best, svg) => {
        if (!best) return svg;
        const svgInHeader = svg.closest('header, nav, [role="banner"]');
        const bestInHeader = best.closest('header, nav, [role="banner"]');
        if (svgInHeader && !bestInHeader) return svg;
        if (!svgInHeader && bestInHeader) return best;
        const svgRect = svg.getBoundingClientRect();
        const bestRect = best.getBoundingClientRect();
        return svgRect.top < bestRect.top ? svg : best;
      }, null);

      if (svgLogo) {
        const resolvedSvg = resolveSvgStyles(svgLogo);
        const serializer = new XMLSerializer();
        const svgStr =
          "data:image/svg+xml;utf8," +
          encodeURIComponent(serializer.serializeToString(resolvedSvg));
        push(svgStr, "logo-svg");
      }
    }

    return imgs;
  };

  const inferPalette = (snapshots, cssColors) => {
    const freq = new Map();
    const bump = (hex, weight = 1) => {
      if (!hex) return;
      freq.set(hex, (freq.get(hex) || 0) + weight);
    };
    for (const s of snapshots) {
      const area = Math.max(1, s.rect.w * s.rect.h);
      bump(s.colors.background, 0.5 + Math.log10(area + 10));
      bump(s.colors.text, 1.0);
      bump(s.colors.border, 0.3);
    }
    for (const c of cssColors) bump(c, 0.5);

    const ranked = Array.from(freq.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([h]) => h);

    const isGrayish = hex => {
      const h = hex.replace("#", "");
      if (h.length < 6) return true;
      const r = parseInt(h.slice(0, 2), 16),
        g = parseInt(h.slice(2, 4), 16),
        b = parseInt(h.slice(4, 6), 16);
      const max = Math.max(r, g, b),
        min = Math.min(r, g, b);
      return max - min < 15;
    };

    const background =
      ranked.find(h => isGrayish(h) && contrastYIQ(h) > 180) || "#FFFFFF";
    const textPrimary =
      ranked.find(h => !/^#FFFFFF$/i.test(h) && contrastYIQ(h) < 160) ||
      "#111111";
    const primary =
      ranked.find(
        h => !isGrayish(h) && h !== textPrimary && h !== background,
      ) || "#000000";
    const accent = ranked.find(h => h !== primary && !isGrayish(h)) || primary;

    const link = document.querySelector("a")
      ? hexify(getComputedStyle(document.querySelector("a")).color) || accent
      : accent;

    return {
      primary,
      accent,
      background,
      text_primary: textPrimary,
      link,
    };
  };

  const inferTypography = () => {
    const pickFF = el => {
      const fontStack = getComputedStyle(el)
        .fontFamily?.split(",")
        .map(f => f.replace(/["']/g, "").trim())
        .filter(Boolean) || [];
      return fontStack[0] || null;
    };
    
    const pickFontStack = el => {
      return getComputedStyle(el)
        .fontFamily?.split(",")
        .map(f => f.replace(/["']/g, "").trim())
        .filter(Boolean) || [];
    };
    
    const h1 = document.querySelector("h1") || document.body;
    const p = document.querySelector("p") || document.body;
    const body = document.body;

    return {
      font_families: {
        primary: pickFF(body) || "system-ui, sans-serif",
        heading: pickFF(h1) || pickFF(body) || "system-ui, sans-serif",
      },
      font_stacks: {
        primary: pickFontStack(body),
        heading: pickFontStack(h1),
        body: pickFontStack(p),
      },
      font_sizes: {
        h1: getComputedStyle(h1).fontSize || "32px",
        h2:
          getComputedStyle(document.querySelector("h2") || h1).fontSize ||
          "24px",
        body: getComputedStyle(p).fontSize || "16px",
      },
    };
  };

  const pickBorderRadius = snapshots => {
    const rs = snapshots.map(s => s.radius).filter(v => Number.isFinite(v));
    if (!rs.length) return "8px";
    rs.sort((a, b) => a - b);
    const med = rs[Math.floor(rs.length / 2)];
    return Math.round(med) + "px";
  };

  const buildComponents = snapshots => {
    // Simplified: Just collect basic component styles
    // LLM handles button classification
    const input = snapshots.find(s => s.isInput);
    const medianRadius = pickBorderRadius(snapshots);

    return {
      input: {
        border_color: input?.colors.border || "#CCCCCC",
        border_radius: medianRadius,
      },
    };
  };

  const inferBaseUnit = values => {
    const vs = values
      .filter(v => Number.isFinite(v) && v > 0 && v <= 128)
      .map(v => Math.round(v));
    if (vs.length === 0) return 8;
    const candidates = [4, 6, 8, 10, 12];
    for (const c of candidates) {
      const ok =
        vs.filter(v => v % c === 0 || Math.abs((v % c) - c) <= 1 || v % c <= 1)
          .length / vs.length;
      if (ok >= 0.6) return c;
    }
    vs.sort((a, b) => a - b);
    const med = vs[Math.floor(vs.length / 2)];
    return Math.max(2, Math.min(12, Math.round(med / 2) * 2));
  };

  const pickLogo = images => {
    const byType = t => images.find(i => i.type === t)?.src;
    return (
      byType("logo") ||
      byType("logo-svg") ||
      byType("og") ||
      byType("twitter") ||
      byType("favicon") ||
      null
    );
  };

  const inferFontsList = (usedFonts = []) => {
    // Only include fonts that are actually rendered on the page
    // Skip CSS-defined fonts that aren't used
    const freq = {};
    for (const f of usedFonts) {
      if (f) freq[f] = (freq[f] || 0) + 1;
    }

    // Sort by frequency and return top 10 (LLM will clean and filter)
    return Object.keys(freq)
      .sort((a, b) => freq[b] - freq[a])
      .slice(0, 10)
      .map(f => ({ family: f, count: freq[f] }));
  };

  // Main execution
  const cssData = collectCSSData();
  const nodes = sampleElements();
  const snaps = nodes.map(getStyleSnapshot);

  const detectColorScheme = () => {
    // Helper to calculate luminance from rgb/rgba string
    const getLuminance = colorStr => {
      if (
        !colorStr ||
        colorStr === "transparent" ||
        colorStr === "rgba(0, 0, 0, 0)"
      )
        return null;

      // Parse rgba or rgb
      const match = colorStr.match(/rgba?\\((\\d+),\\s*(\\d+),\\s*(\\d+)/);
      if (!match) return null;

      const [r, g, b] = match.slice(1, 4).map(n => parseInt(n, 10));
      // Calculate relative luminance
      const [rs, gs, bs] = [r, g, b].map(c => {
        c = c / 255;
        return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
      });
      return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
    };

    const body = document.body;
    const html = document.documentElement;

    // Check explicit dark mode indicators first (most reliable)
    const hasDarkClass =
      html.classList.contains("dark") ||
      body.classList.contains("dark") ||
      html.classList.contains("dark-mode") ||
      body.classList.contains("dark-mode") ||
      html.classList.contains("theme-dark");
    const hasDarkAttr =
      html.getAttribute("data-theme") === "dark" ||
      body.getAttribute("data-theme") === "dark" ||
      html.getAttribute("data-bs-theme") === "dark"; // Bootstrap

    if (hasDarkClass || hasDarkAttr) {
      return "dark";
    }

    // Check body/html backgrounds
    const bodyBg = getComputedStyle(body).backgroundColor;
    const htmlBg = getComputedStyle(html).backgroundColor;
    let bodyLum = getLuminance(bodyBg);
    let htmlLum = getLuminance(htmlBg);

    // If body/html are transparent, check main content containers
    if (bodyLum === null && htmlLum === null) {
      const mainContainers = [
        document.querySelector("main"),
        document.querySelector('[role="main"]'),
        document.querySelector("#root"),
        document.querySelector("#__next"),
        document.querySelector(".app"),
        document.querySelector(".main"),
        document.body.firstElementChild,
      ].filter(Boolean);

      for (const container of mainContainers) {
        const bg = getComputedStyle(container).backgroundColor;
        const lum = getLuminance(bg);
        if (lum !== null) {
          bodyLum = lum;
          break;
        }
      }
    }

    const luminance = bodyLum ?? htmlLum ?? 1; // Default to light if can't determine

    // Luminance < 0.5 means dark background (closer to black)
    // For better accuracy, use 0.4 as threshold (accounts for slightly off-black backgrounds)
    const isDarkByColor = luminance < 0.4;

    return isDarkByColor ? "dark" : "light";
  };

  const palette = inferPalette(snaps, cssData.colors);
  const typography = inferTypography();
  const baseUnit = inferBaseUnit(cssData.spacings);
  const borderRadius = pickBorderRadius(snaps);
  const images = findImages();
  
  // Collect all fonts from rendered elements including fallbacks
  // Flatten font stacks from typography (body, headings)
  const typographyFontStacks = typography.font_stacks 
    ? Object.values(typography.font_stacks).flat().filter(Boolean)
    : [];
  
  // Flatten font stacks from sampled elements (buttons, links, etc.)
  const elementFontStacks = snaps
    .map(s => s.typography?.fontStack || [])
    .flat()
    .filter(Boolean);
  
  // Combine all fonts including fallbacks for better context
  const fontsList = inferFontsList([...typographyFontStacks, ...elementFontStacks]);
  const components = buildComponents(snaps);
  const colorScheme = detectColorScheme();

  const imagesOut = {
    logo: pickLogo(images),
    favicon: images.find(i => i.type === "favicon")?.src || null,
    og_image:
      images.find(i => i.type === "og")?.src ||
      images.find(i => i.type === "twitter")?.src ||
      null,
  };
  
  // Detect framework hints from meta tags and scripts
  const detectFrameworkHints = () => {
    const hints = [];
    
    // Check meta generator
    const generator = document.querySelector('meta[name="generator"]');
    if (generator) {
      hints.push(generator.getAttribute('content') || '');
    }
    
    // Check for framework-specific script tags
    const scripts = Array.from(document.querySelectorAll('script[src]'))
      .map(s => s.getAttribute('src') || '')
      .filter(Boolean);
    
    if (scripts.some(s => s.includes('tailwind') || s.includes('cdn.tailwindcss'))) {
      hints.push('tailwind-detected-in-scripts');
    }
    if (scripts.some(s => s.includes('bootstrap'))) {
      hints.push('bootstrap-detected-in-scripts');
    }
    if (scripts.some(s => s.includes('mui') || s.includes('material-ui'))) {
      hints.push('material-ui-detected-in-scripts');
    }
    
    return hints.filter(Boolean);
  };
  
  const frameworkHints = detectFrameworkHints();

  // Extract button snapshots for LLM
  const buttonSnapshots = snaps
    .filter(s => s.isButton)
    .slice(0, 20) // Send top 20 buttons to LLM
    .map((s, idx) => ({
      index: idx,
      text: s.text || "",
      html: "", // Will be filled from rawHtml in transformer
      classes: s.classNames || "",
      background: s.colors?.background || "transparent",
      textColor: s.colors?.text || "#000000",
      // Only include border if there's an actual border width
      borderColor:
        s.colors?.borderWidth && s.colors.borderWidth > 0
          ? s.colors.border
          : null,
      borderRadius: s.radius || "0px",
    }));

  const result = {
    color_scheme: colorScheme,
    fonts: fontsList,
    colors: palette,
    typography,
    spacing: {
      base_unit: baseUnit,
      border_radius: borderRadius,
    },
    components,
    images: imagesOut,
    __button_snapshots: buttonSnapshots, // For LLM analysis
    __framework_hints: frameworkHints, // For LLM framework detection
  };

  // Clean null/undefined/empty values
  const clean = obj => {
    if (Array.isArray(obj))
      return obj
        .map(clean)
        .filter(
          v => v != null && (typeof v !== "object" || Object.keys(v).length),
        );
    if (obj && typeof obj === "object") {
      const o = {};
      for (const [k, v] of Object.entries(obj)) {
        const cv = clean(v);
        if (
          cv !== null &&
          (typeof cv !== "object" ||
            (Array.isArray(cv) ? cv.length : Object.keys(cv).length))
        )
          o[k] = cv;
      }
      return o;
    }
    return obj == null ? null : obj;
  };

  return clean(result);
})();
`;
