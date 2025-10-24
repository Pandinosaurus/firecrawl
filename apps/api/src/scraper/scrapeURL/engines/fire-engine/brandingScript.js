/**
 * Extracts brand design elements from the page.
 * This script is executed in the page context using `await page.evaluate(() => { ... });`.
 
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

  const cleanNextJsFontName = fontName => {
    // Clean up Next.js font names like "__suisse_6d5c28" -> "Suisse"
    // or "__Roboto_Mono_c8ca7d" -> "Roboto Mono"
    // or "__suisse_Fallback_6d5c28" -> skip (it's a fallback)
    if (fontName.startsWith("__")) {
      // Skip fallback fonts
      if (fontName.includes("_Fallback_")) return null;

      // Remove leading underscores and trailing hash (_6d5c28)
      const cleaned = fontName.replace(/^__/, "").replace(/_[a-f0-9]{6}$/, "");
      // Replace underscores with spaces and capitalize each word
      return cleaned
        .split("_")
        .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join(" ");
    }
    return fontName;
  };

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
      /color\((?:display-p3|srgb)\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)\s*\/\s*([\d.]+)/i,
    );
    if (colorMatchWithAlpha) {
      const [r, g, b, a] = colorMatchWithAlpha
        .slice(1, 5)
        .map(n => parseFloat(n));
      const rgb = [r, g, b].map(n => clamp(Math.round(n * 255), 0, 255));
      return `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, ${a.toFixed(2)})`;
    }

    // Try parsing Display P3 or other color() formats without alpha
    const colorMatch = rgba.match(
      /color\((?:display-p3|srgb)\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)/i,
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
      /^rgba?\((\d+),\s*(\d+),\s*(\d+),\s*([\d.]+)/i,
    );
    if (rgbaMatch) {
      const [r, g, b, a] = rgbaMatch.slice(1, 5);
      return `rgba(${r}, ${g}, ${b}, ${parseFloat(a).toFixed(2)})`;
    }

    // Try direct parsing for rgb() format
    const directMatch = rgba.match(/^rgba?\((\d+),\s*(\d+),\s*(\d+)/i);
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
    const m = val.match(/^rgba?\((\d+),\s*(\d+),\s*(\d+)/i);
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
      return true; // Accept all rgba/rgb colors (including with alpha)
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
      fonts: [],
      fontFaces: [],
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
            ["font", "font-family"].forEach(prop => {
              const val = s.getPropertyValue(prop);
              if (val) {
                // Split by comma to get all fonts in the stack
                const fontStack = val
                  .split(",")
                  .map(f => f.replace(/["']/g, "").trim())
                  .filter(Boolean);
                data.fonts.push(...fontStack);
              }
            });
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
          } else if (rule.type === CSSRule.FONT_FACE_RULE) {
            const s = rule.style;
            const fam = s
              .getPropertyValue("font-family")
              ?.replace(/["']/g, "")
              .trim();
            const src = s.getPropertyValue("src") || "";
            data.fontFaces.push({ family: fam || "", src });
            if (fam) data.fonts.push(fam);
          }
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
    pushQ('button, [role=button], a.button, a.btn, [class*="btn"]', 30);
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

    const color = hexify(colorRaw);
    const bg = hexify(bgRaw);
    const bc = hexify(bcRaw);
    const radius = toPx(cs.getPropertyValue("border-radius"));
    const fw = parseInt(cs.getPropertyValue("font-weight"), 10) || null;
    const ffRaw = cs
      .getPropertyValue("font-family")
      ?.split(",")[0]
      ?.replace(/["']/g, "")
      .trim();
    const ff = ffRaw ? cleanNextJsFontName(ffRaw) || ffRaw : null;
    const fs = cs.getPropertyValue("font-size");

    const classNames = el.className ? String(el.className).toLowerCase() : "";

    return {
      tag: el.tagName.toLowerCase(),
      classNames,
      rect: { w: rect.width, h: rect.height },
      colors: { text: color, background: bg, border: bc },
      typography: { family: ff, size: fs || null, weight: fw },
      radius,
      isButton: el.matches(
        'button,[role=button],a.button,a.btn,[class*="btn"]',
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
      const ff = getComputedStyle(el)
        .fontFamily?.split(",")[0]
        ?.replace(/["']/g, "")
        .trim();
      if (!ff) return null;
      // Clean Next.js font names
      const cleaned = cleanNextJsFontName(ff);
      return cleaned || ff;
    };
    const h1 = document.querySelector("h1") || document.body;
    const p = document.querySelector("p") || document.body;
    const body = document.body;

    return {
      font_families: {
        primary: pickFF(body) || "system-ui, sans-serif",
        heading: pickFF(h1) || pickFF(body) || "system-ui, sans-serif",
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

  const buildComponents = (snapshots, palette) => {
    // Get all buttons
    const allButtons = snapshots.filter(s => s.isButton);

    // Try to find primary button (by class name pattern)
    const primaryButtonByClass = allButtons.find(
      s =>
        s.classNames &&
        (s.classNames.includes("primary") ||
          s.classNames.includes("cta") ||
          s.classNames.includes("button-primary")),
    );

    // Try to find secondary button (by class name pattern)
    const secondaryButtonByClass = allButtons.find(s => {
      if (!s.classNames) return false;

      // classNames is already lowercase from getStyleSnapshot
      const classes = s.classNames.split(/\s+/);

      // Check for exact secondary class patterns (more strict)
      const hasExactSecondaryClass = classes.some(
        cls =>
          cls === "secondary" ||
          cls === "button-secondary" ||
          cls === "btn-secondary" ||
          cls === "outline" ||
          cls === "ghost" ||
          // Only match if it ends with or starts with secondary (not tertiary, etc)
          (cls.includes("secondary") && !cls.includes("tertiary")),
      );

      // Check for button + secondary combination
      const hasButton = classes.some(cls => cls === "button" || cls === "btn");
      const hasSecondary = classes.some(cls => cls === "secondary");
      const hasButtonAndSecondary = hasButton && hasSecondary;

      return hasExactSecondaryClass || hasButtonAndSecondary;
    });

    // Get buttons with valid colored backgrounds
    const buttonsWithColor = allButtons.filter(
      s => s.colors.background && isColorValid(s.colors.background),
    );

    // Sort by size (larger = more prominent)
    buttonsWithColor.sort((a, b) => b.rect.w * b.rect.h - a.rect.w * a.rect.h);

    // Pick primary: explicit primary class > largest colored button > any button
    const primaryBtn =
      primaryButtonByClass &&
      primaryButtonByClass.colors.background &&
      isColorValid(primaryButtonByClass.colors.background)
        ? primaryButtonByClass
        : buttonsWithColor[0] || primaryButtonByClass || allButtons[0];

    // Pick secondary: find most common button style that's different from primary
    let secondaryBtn = secondaryButtonByClass;

    if (!secondaryBtn) {
      // Get all buttons that are NOT the primary button
      const nonPrimaryButtons = allButtons.filter(b => b !== primaryBtn);

      if (nonPrimaryButtons.length > 0) {
        // Group buttons by their style signature (bg + border + text)
        const styleGroups = {};

        for (const btn of nonPrimaryButtons) {
          // Create a style signature
          const signature = `${btn.colors.background || "transparent"}|${btn.colors.border || "none"}|${btn.colors.text || "inherit"}`;

          // Skip if this matches primary style (unlikely but check)
          const primarySignature = `${primaryBtn?.colors.background || "transparent"}|${primaryBtn?.colors.border || "none"}|${primaryBtn?.colors.text || "inherit"}`;
          if (signature === primarySignature) continue;

          if (!styleGroups[signature]) {
            styleGroups[signature] = { buttons: [], count: 0 };
          }
          styleGroups[signature].buttons.push(btn);
          styleGroups[signature].count++;
        }

        // Filter to only groups with at least 2 buttons (or 3+ for more confidence)
        const MIN_COUNT = 2;
        const validGroups = Object.entries(styleGroups)
          .filter(([_, group]) => group.count >= MIN_COUNT)
          .sort((a, b) => b[1].count - a[1].count); // Sort by count descending

        // Use the most common valid group
        if (validGroups.length > 0) {
          secondaryBtn = validGroups[0][1].buttons[0];
        } else {
          // Fallback: if no style appears 2+ times, find any button that's visually distinct
          // (different background OR has a border when primary doesn't)
          const distinctBtn = nonPrimaryButtons.find(b => {
            const hasDifferentBg =
              b.colors.background !== primaryBtn?.colors.background;
            const hasBorder =
              b.colors.border &&
              isColorValid(b.colors.border) &&
              b.colors.border !== "rgba(0, 0, 0, 0)";
            const primaryHasBorder =
              primaryBtn?.colors.border &&
              isColorValid(primaryBtn.colors.border);

            return hasDifferentBg || (hasBorder && !primaryHasBorder);
          });

          secondaryBtn = distinctBtn || null;
        }
      }
    }

    const primaryBg =
      primaryBtn?.colors.background &&
      isColorValid(primaryBtn.colors.background)
        ? primaryBtn.colors.background
        : palette.primary;
    const primaryText =
      primaryBtn?.colors.text ||
      (contrastYIQ(primaryBg) < 128 ? "#FFFFFF" : "#111111");
    const primaryRadius =
      primaryBtn?.radius && primaryBtn.radius > 0
        ? Math.round(primaryBtn.radius) + "px"
        : pickBorderRadius(snapshots);

    const secondaryBg =
      secondaryBtn?.colors.background &&
      isColorValid(secondaryBtn.colors.background)
        ? secondaryBtn.colors.background
        : "transparent";
    const secondaryBorder =
      secondaryBtn?.colors.border && isColorValid(secondaryBtn.colors.border)
        ? secondaryBtn.colors.border
        : palette.primary;
    const secondaryText = secondaryBtn?.colors.text || palette.primary;
    const secondaryRadius =
      secondaryBtn?.radius && secondaryBtn.radius > 0
        ? Math.round(secondaryBtn.radius) + "px"
        : primaryRadius;

    const input = snapshots.find(s => s.isInput);
    const medianRadius = pickBorderRadius(snapshots);

    return {
      button_primary: {
        background: primaryBg,
        text_color: primaryText,
        border_radius: primaryRadius,
      },
      button_secondary: secondaryBtn
        ? {
            background: secondaryBg,
            text_color: secondaryText,
            border_color: secondaryBorder,
            border_radius: secondaryRadius,
          }
        : null,
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

  const inferFontsList = (fontFaces, cssFonts) => {
    const allFonts = fontFaces
      .map(f => f.family)
      .concat(cssFonts)
      .filter(Boolean);

    // Resolve CSS variables and clean font names
    const resolvedFonts = allFonts
      .map(f => {
        // Skip CSS variables (var()) - they should have been resolved in CSS collection
        if (f.includes("var(")) return null;

        // Clean Next.js font names
        return cleanNextJsFontName(f);
      })
      .filter(Boolean);

    // Count frequency of each font
    const freq = {};
    for (const f of resolvedFonts) {
      freq[f] = (freq[f] || 0) + 1;
    }

    // Filter out generic/system font names and sort by frequency
    const filtered = Object.keys(freq)
      .filter(f => {
        const generic = [
          "inherit",
          "initial",
          "unset",
          "revert",
          "ui-sans-serif",
          "ui-serif",
          "ui-monospace",
          "system-ui",
          "sans-serif",
          "serif",
          "monospace",
          "cursive",
          "fantasy",
          "math",
          "emoji",
          "fangsong",
          "apple color emoji",
          "segoe ui emoji",
          "segoe ui symbol",
          "noto color emoji",
        ];
        return !generic.includes(f.toLowerCase());
      })
      .sort((a, b) => freq[b] - freq[a])
      .slice(0, 5); // Limit to top 5 most used fonts

    return filtered.map(f => ({ family: f }));
  };

  // Main execution
  const cssData = collectCSSData();
  const nodes = sampleElements();
  const snaps = nodes.map(getStyleSnapshot);

  const palette = inferPalette(snaps, cssData.colors);
  const typography = inferTypography();
  const baseUnit = inferBaseUnit(cssData.spacings);
  const borderRadius = pickBorderRadius(snaps);
  const images = findImages();
  const fontsList = inferFontsList(cssData.fontFaces, cssData.fonts);
  const components = buildComponents(snaps, palette);

  const imagesOut = {
    logo: pickLogo(images),
    favicon: images.find(i => i.type === "favicon")?.src || null,
    og_image:
      images.find(i => i.type === "og")?.src ||
      images.find(i => i.type === "twitter")?.src ||
      null,
  };

  const result = {
    fonts: fontsList,
    colors: palette,
    typography,
    spacing: {
      base_unit: baseUnit,
      border_radius: borderRadius,
    },
    components,
    images: imagesOut,
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
