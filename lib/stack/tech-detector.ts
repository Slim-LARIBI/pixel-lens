export type DetectedTech = {
  name: string;
  confidence: "HIGH" | "MEDIUM" | "LOW";
  evidence: string[];
};

export type TechStackResult = {
  platform: DetectedTech[];
  frontend: DetectedTech[];
  ecommerce: DetectedTech[];
  tracking: DetectedTech[];
  infrastructure: DetectedTech[];
  security: DetectedTech[];
};

type DetectInput = {
  url: string;
  html: string;
  requests: Array<{ url: string; method?: string }>;
};

type Bucket =
  | "platform"
  | "frontend"
  | "ecommerce"
  | "tracking"
  | "infrastructure"
  | "security";

type Candidate = {
  bucket: Bucket;
  name: string;
  score: number;
  evidence: string[];
};

function uniq(arr: string[]) {
  return Array.from(new Set((arr || []).filter(Boolean)));
}

function regex(text: string, pattern: RegExp) {
  return pattern.test(text);
}

function includesAny(text: string, patterns: string[]) {
  const s = String(text || "").toLowerCase();
  return patterns.some((p) => s.includes(p.toLowerCase()));
}

function pushCandidate(
  store: Map<string, Candidate>,
  bucket: Bucket,
  name: string,
  score: number,
  evidence: string
) {
  const key = `${bucket}::${name}`;
  const existing = store.get(key);

  if (!existing) {
    store.set(key, {
      bucket,
      name,
      score,
      evidence: [evidence],
    });
    return;
  }

  existing.score += score;
  existing.evidence.push(evidence);
}

function confidenceFromScore(score: number): "HIGH" | "MEDIUM" | "LOW" {
  if (score >= 80) return "HIGH";
  if (score >= 40) return "MEDIUM";
  return "LOW";
}

function finalizeBucket(
  store: Map<string, Candidate>,
  bucket: Bucket
): DetectedTech[] {
  return Array.from(store.values())
    .filter((item) => item.bucket === bucket && item.score >= 40)
    .sort((a, b) => b.score - a.score)
    .map((item) => ({
      name: item.name,
      confidence: confidenceFromScore(item.score),
      evidence: uniq(item.evidence).slice(0, 8),
    }));
}

function hasRequest(requests: string[], patterns: string[]) {
  const joined = requests.join("\n").toLowerCase();
  return includesAny(joined, patterns);
}

function hasHtml(html: string, patterns: string[]) {
  return includesAny(html, patterns);
}

export function detectTechStack({
  url,
  html,
  requests,
}: DetectInput): TechStackResult {
  const store = new Map<string, Candidate>();

  const htmlRaw = String(html || "");
  const htmlLower = htmlRaw.toLowerCase();
  const urlLower = String(url || "").toLowerCase();
  const requestUrls = (requests || []).map((r) => String(r.url || ""));
  const requestText = requestUrls.join("\n").toLowerCase();

  // =========================================================
  // PLATFORM — WORDPRESS
  // =========================================================
  if (hasHtml(htmlLower, ["/wp-content/", "/wp-includes/"])) {
    pushCandidate(store, "platform", "WordPress", 70, "HTML contains WordPress core paths");
  }

  if (regex(htmlRaw, /<meta[^>]+name=["']generator["'][^>]+wordpress/i)) {
    pushCandidate(store, "platform", "WordPress", 95, 'Meta generator contains "WordPress"');
  }

  if (hasRequest(requestUrls, ["/wp-content/", "/wp-includes/"])) {
    pushCandidate(store, "platform", "WordPress", 50, "Network requests contain WordPress assets");
  }

  // =========================================================
  // PLATFORM — WOOCOMMERCE
  // =========================================================
  if (hasHtml(htmlLower, ["/wp-content/plugins/woocommerce", "woocommerce"])) {
    pushCandidate(store, "platform", "WooCommerce", 75, "WooCommerce plugin signature detected");
    pushCandidate(store, "ecommerce", "WooCommerce Engine", 75, "WooCommerce plugin signature detected");
  }

  if (hasRequest(requestUrls, ["wc-ajax", "/?wc-ajax="])) {
    pushCandidate(store, "platform", "WooCommerce", 65, "WooCommerce AJAX endpoint detected");
    pushCandidate(store, "ecommerce", "WooCommerce Cart", 65, "WooCommerce AJAX endpoint detected");
  }

  if (hasHtml(htmlLower, ["single_add_to_cart_button", "woocommerce-loop-product__link"])) {
    pushCandidate(store, "ecommerce", "WooCommerce Product Templates", 60, "WooCommerce product classes detected");
  }

  // =========================================================
  // PLATFORM — SHOPIFY (REINFORCED)
  // Goal:
  // - detect storefront even when theme is custom
  // - detect checkout / payment layer
  // - accumulate enough evidence to reach HIGH confidence
  // =========================================================

  // Shopify CDN / storefront assets
  if (hasRequest(requestUrls, ["cdn.shopify.com", "/cdn/shop/"])) {
    pushCandidate(store, "platform", "Shopify", 95, "Shopify CDN assets detected");
    pushCandidate(store, "ecommerce", "Shopify Storefront", 95, "Shopify CDN storefront assets detected");
  }

  if (hasHtml(htmlLower, ["cdn.shopify.com", "/cdn/shop/", "shopify-payment-button", "myshopify.com"])) {
    pushCandidate(store, "platform", "Shopify", 85, "Shopify storefront asset detected in HTML");
    pushCandidate(store, "ecommerce", "Shopify Storefront", 85, "Shopify storefront asset detected in HTML");
  }

  // Shopify runtime objects
  if (regex(htmlRaw, /window\.Shopify|Shopify\.theme|ShopifyAnalytics|Shopify\.routes|Shopify\.locale/i)) {
    pushCandidate(store, "platform", "Shopify", 95, "Global Shopify runtime object detected");
    pushCandidate(store, "ecommerce", "Shopify Storefront", 90, "Shopify runtime detected");
  }

  // Shopify checkout markers
  if (regex(htmlRaw, /Shopify\.Checkout|shopify-checkout-api-token|checkout\.shopify\.com/i)) {
    pushCandidate(store, "platform", "Shopify", 70, "Shopify checkout marker detected");
    pushCandidate(store, "ecommerce", "Shopify Checkout", 95, "Shopify checkout signature detected");
  }

  // Shopify storefront meta / wallet
  if (regex(htmlRaw, /shopify-digital-wallet|Shopify\.shop|shopify-buy-button/i)) {
    pushCandidate(store, "platform", "Shopify", 80, "Shopify storefront meta detected");
    pushCandidate(store, "ecommerce", "Shopify Storefront", 70, "Shopify storefront meta detected");
  }

  // Shopify cookies / inline config
  if (regex(htmlRaw, /_shopify_y|_shopify_s|_shopify_sa_t|_shopify_sa_p/i)) {
    pushCandidate(store, "platform", "Shopify", 70, "Shopify cookie detected");
  }

  if (regex(htmlRaw, /Shopify\.country|Shopify\.currency|ShopifyAnalytics\.meta/i)) {
    pushCandidate(store, "platform", "Shopify", 75, "Shopify analytics metadata detected");
    pushCandidate(store, "ecommerce", "Shopify Storefront", 60, "Shopify analytics metadata detected");
  }

  // Theme / cart / product signals frequently seen on Shopify
  if (hasHtml(htmlLower, ["shopify-section", "product-form", "cart-drawer", "cart-notification"])) {
    pushCandidate(store, "platform", "Shopify", 55, "Shopify theme DOM patterns detected");
    pushCandidate(store, "ecommerce", "Shopify Theme Components", 60, "Shopify cart/product theme patterns detected");
  }

  // =========================================================
  // PLATFORM — PRESTASHOP
  // =========================================================
  if (hasHtml(htmlLower, ["prestashop"])) {
    pushCandidate(store, "platform", "PrestaShop", 70, "Prestashop keyword detected");
  }

  if (hasRequest(requestUrls, ["prestashop"])) {
    pushCandidate(store, "platform", "PrestaShop", 55, "Prestashop network signature detected");
  }

  // =========================================================
  // PLATFORM — MAGENTO
  // =========================================================
  if (hasHtml(htmlLower, ["mage/cookies", "magento", "/static/version"])) {
    pushCandidate(store, "platform", "Magento", 75, "Magento signature detected");
  }

  if (hasRequest(requestUrls, ["mage/", "/static/version"])) {
    pushCandidate(store, "platform", "Magento", 55, "Magento network signature detected");
  }

  // =========================================================
  // FRONTEND — NEXT.JS
  // =========================================================
  if (hasHtml(htmlLower, ['id="__next"', "id='__next'", "/_next/static/", "/_next/"])) {
    pushCandidate(store, "frontend", "Next.js", 95, "Next.js root or static assets detected");
    pushCandidate(store, "frontend", "React", 60, "Next.js implies React");
  }

  if (hasRequest(requestUrls, ["/_next/static/", "/_next/"])) {
    pushCandidate(store, "frontend", "Next.js", 80, "Next.js network assets detected");
    pushCandidate(store, "frontend", "React", 50, "Next.js network implies React");
  }

  // =========================================================
  // FRONTEND — REACT
  // =========================================================
  if (regex(htmlRaw, /__REACT_DEVTOOLS_GLOBAL_HOOK__|data-reactroot|data-react-helmet/i)) {
    pushCandidate(store, "frontend", "React", 80, "React runtime markers detected");
  }

  if (hasRequest(requestUrls, ["react-dom", "react.production.min.js", "react.development.js"])) {
    pushCandidate(store, "frontend", "React", 70, "React JS asset detected");
  }

  // =========================================================
  // FRONTEND — VUE
  // =========================================================
  if (regex(htmlRaw, /data-v-[a-z0-9]+/i)) {
    pushCandidate(store, "frontend", "Vue.js", 80, "Vue scoped style marker detected");
  }

  if (hasRequest(requestUrls, ["vue.runtime", "vue.global", "vue.esm"])) {
    pushCandidate(store, "frontend", "Vue.js", 70, "Vue JS asset detected");
  }

  // =========================================================
  // FRONTEND — ANGULAR
  // =========================================================
  if (regex(htmlRaw, /\bng-version=|ng-app|ng-controller/i)) {
    pushCandidate(store, "frontend", "Angular", 80, "Angular DOM marker detected");
  }

  if (hasRequest(requestUrls, ["zone.js", "@angular", "angular.min.js"])) {
    pushCandidate(store, "frontend", "Angular", 75, "Angular/Zone.js asset detected");
  }

  if (hasRequest(requestUrls, ["zone.js"])) {
    pushCandidate(store, "frontend", "Zone.js", 80, "Zone.js asset detected");
  }

  // =========================================================
  // FRONTEND — JQUERY
  // =========================================================
  if (hasRequest(requestUrls, ["jquery.min.js", "/jquery.js", "code.jquery.com/jquery"])) {
    pushCandidate(store, "frontend", "jQuery", 80, "jQuery asset detected");
  }

  if (regex(htmlRaw, /\$\(|jQuery\(/i)) {
    pushCandidate(store, "frontend", "jQuery", 45, "jQuery usage detected");
  }

  // =========================================================
  // FRONTEND — SWIPER
  // =========================================================
  if (hasRequest(requestUrls, ["swiper-bundle", "swiper.min.js", "swiper.min.css"])) {
    pushCandidate(store, "frontend", "Swiper.js", 85, "Swiper asset detected");
  }

  if (hasHtml(htmlLower, ["swiper-wrapper", "swiper-slide"])) {
    pushCandidate(store, "frontend", "Swiper.js", 55, "Swiper DOM classes detected");
  }

  // =========================================================
  // FRONTEND — TAILWIND
  // =========================================================
  if (
    hasRequest(requestUrls, ["tailwind"]) ||
    regex(
      htmlRaw,
      /class=["'][^"']*(?:\bsm:|\bmd:|\blg:|\bxl:|\b2xl:|\bfont-bold\b|\btracking-tight\b)[^"']*["']/i
    )
  ) {
    pushCandidate(store, "frontend", "Tailwind CSS", 55, "Tailwind-like utility classes or asset detected");
  }

  // =========================================================
  // FRONTEND — BOOTSTRAP
  // =========================================================
  if (hasRequest(requestUrls, ["bootstrap.min.css", "bootstrap.bundle", "bootstrap.min.js"])) {
    pushCandidate(store, "frontend", "Bootstrap", 85, "Bootstrap asset detected");
  }

  if (regex(htmlRaw, /class=["'][^"']*\bcontainer\b[^"']*\brow\b/i)) {
    pushCandidate(store, "frontend", "Bootstrap", 45, "Bootstrap layout classes detected");
  }

  // =========================================================
  // TRACKING — GTM
  // =========================================================
  if (hasRequest(requestUrls, ["googletagmanager.com/gtm.js?id=gtm-"])) {
    pushCandidate(store, "tracking", "Google Tag Manager", 95, "GTM network request detected");
  }

  if (regex(htmlRaw, /\bGTM-[A-Z0-9]+\b/i)) {
    pushCandidate(store, "tracking", "Google Tag Manager", 60, "GTM container ID found in HTML");
  }

  // =========================================================
  // TRACKING — GA4
  // =========================================================
  if (hasRequest(requestUrls, ["google-analytics.com/g/collect", "googletagmanager.com/gtag/js?id=g-"])) {
    pushCandidate(store, "tracking", "Google Analytics 4", 95, "GA4 request or gtag loader detected");
  }

  if (regex(htmlRaw, /\bG-[A-Z0-9]{8,}\b/)) {
    pushCandidate(store, "tracking", "Google Analytics 4", 55, "GA4 measurement ID found in HTML");
  }

  // =========================================================
  // TRACKING — META PIXEL
  // =========================================================
  if (hasRequest(requestUrls, ["facebook.com/tr", "connect.facebook.net"])) {
    pushCandidate(store, "tracking", "Meta Pixel", 95, "Meta Pixel network request detected");
  }

  if (regex(htmlRaw, /\bfbq\(/i)) {
    pushCandidate(store, "tracking", "Meta Pixel", 60, "fbq() detected in HTML/scripts");
  }

  // =========================================================
  // TRACKING — GOOGLE ADS
  // =========================================================
  if (
    hasRequest(requestUrls, [
      "googleadservices.com/pagead/",
      "doubleclick.net/pagead/",
      "googlesyndication.com",
    ])
  ) {
    pushCandidate(store, "tracking", "Google Ads", 90, "Google Ads network request detected");
  }

  if (regex(htmlRaw, /\bAW-[0-9]+\b/)) {
    pushCandidate(store, "tracking", "Google Ads", 55, "Google Ads conversion ID found in HTML");
  }

  // =========================================================
  // TRACKING — SERVER SIDE
  // =========================================================
  if (
    hasRequest(requestUrls, [
      "sgtm",
      "server-gtm",
      "gtm-server",
      "/metrics",
      "/collect?v=2",
      "/mp/collect",
    ])
  ) {
    pushCandidate(store, "tracking", "Server-side Tracking Signals", 60, "Possible server-side tracking endpoint detected");
  }

  if (
    includesAny(requestText, ["/g/collect"]) &&
    !includesAny(requestText, ["google-analytics.com/g/collect"])
  ) {
    pushCandidate(store, "tracking", "Server-side Tracking Signals", 45, "Custom /g/collect-like endpoint detected");
  }

  // =========================================================
  // TRACKING / CRM / MARKETING AUTOMATION
  // =========================================================
  if (hasRequest(requestUrls, ["js.hs-scripts.com", "hs-analytics.net", "hubspot"])) {
    pushCandidate(store, "tracking", "HubSpot", 90, "HubSpot script/network detected");
  }

  if (hasRequest(requestUrls, ["sendinblue", "brevo"])) {
    pushCandidate(store, "tracking", "Brevo / Sendinblue", 90, "Brevo/Sendinblue script detected");
  }

  if (hasRequest(requestUrls, ["klaviyo.com", "static.klaviyo.com"])) {
    pushCandidate(store, "tracking", "Klaviyo", 90, "Klaviyo script/network detected");
  }

  if (hasRequest(requestUrls, ["mailchimp", "mcjs", "chimpstatic"])) {
    pushCandidate(store, "tracking", "Mailchimp", 90, "Mailchimp script/network detected");
  }

  if (hasRequest(requestUrls, ["pushowl"])) {
    pushCandidate(store, "tracking", "PushOwl", 90, "PushOwl detected");
  }

  if (hasRequest(requestUrls, ["segment.com", "cdn.segment.com"])) {
    pushCandidate(store, "tracking", "Segment", 90, "Segment detected");
  }

  if (hasRequest(requestUrls, ["hotjar"])) {
    pushCandidate(store, "tracking", "Hotjar", 90, "Hotjar detected");
  }

  if (hasRequest(requestUrls, ["clarity.ms"])) {
    pushCandidate(store, "tracking", "Microsoft Clarity", 90, "Microsoft Clarity detected");
  }

  if (hasRequest(requestUrls, ["fullstory.com"])) {
    pushCandidate(store, "tracking", "FullStory", 90, "FullStory detected");
  }

  if (hasRequest(requestUrls, ["intercom"])) {
    pushCandidate(store, "tracking", "Intercom", 90, "Intercom detected");
  }

  if (hasRequest(requestUrls, ["zendesk"])) {
    pushCandidate(store, "tracking", "Zendesk", 90, "Zendesk widget detected");
  }

  // =========================================================
  // ECOMMERCE / PAYMENTS
  // =========================================================
  if (hasHtml(htmlLower, ["add-to-cart", "single_add_to_cart_button"])) {
    pushCandidate(store, "ecommerce", "Add to Cart UI", 60, "Add to cart UI signature detected");
  }

  if (includesAny(urlLower, ["/checkout", "/commande", "/commander"])) {
    pushCandidate(store, "ecommerce", "Checkout Flow", 60, "Checkout URL detected");
  }

  if (hasRequest(requestUrls, ["js.stripe.com", "api.stripe.com"])) {
    pushCandidate(store, "ecommerce", "Stripe", 95, "Stripe SDK/API detected");
  }

  if (hasHtml(htmlLower, ["stripe"])) {
    pushCandidate(store, "ecommerce", "Stripe", 45, "Stripe keyword detected");
  }

  if (hasRequest(requestUrls, ["paypal.com/sdk/js", "paypalobjects.com"])) {
    pushCandidate(store, "ecommerce", "PayPal", 95, "PayPal SDK detected");
  }

  if (hasHtml(htmlLower, ["paypal"])) {
    pushCandidate(store, "ecommerce", "PayPal", 45, "PayPal keyword detected");
  }

  // =========================================================
  // INFRASTRUCTURE
  // =========================================================
  if (hasRequest(requestUrls, ["cloudflare"])) {
    pushCandidate(store, "infrastructure", "Cloudflare", 80, "Cloudflare asset/request detected");
  }

  if (hasHtml(htmlLower, ["cloudflare"])) {
    pushCandidate(store, "infrastructure", "Cloudflare", 45, 'HTML contains "cloudflare"');
  }

  if (hasRequest(requestUrls, ["cloudfront.net"])) {
    pushCandidate(store, "infrastructure", "AWS CloudFront", 85, "CloudFront request detected");
  }

  if (hasRequest(requestUrls, ["fastly.net"])) {
    pushCandidate(store, "infrastructure", "Fastly", 85, "Fastly request detected");
  }

  if (hasRequest(requestUrls, ["cdn.jsdelivr.net", "unpkg.com", "cdnjs.cloudflare.com"])) {
    pushCandidate(store, "infrastructure", "Public CDN Assets", 50, "Public CDN detected");
  }

  // =========================================================
  // SECURITY / CONSENT
  // =========================================================
  if (hasRequest(requestUrls, ["google.com/recaptcha", "gstatic.com/recaptcha"])) {
    pushCandidate(store, "security", "reCAPTCHA", 95, "reCAPTCHA asset detected");
  }

  if (hasHtml(htmlLower, ["g-recaptcha", "grecaptcha"])) {
    pushCandidate(store, "security", "reCAPTCHA", 60, "reCAPTCHA markup/runtime detected");
  }

  if (hasRequest(requestUrls, ["onetrust"])) {
    pushCandidate(store, "security", "OneTrust", 95, "OneTrust CMP detected");
  }

  if (hasRequest(requestUrls, ["cookiebot"])) {
    pushCandidate(store, "security", "Cookiebot", 95, "Cookiebot CMP detected");
  }

  if (hasRequest(requestUrls, ["didomi"])) {
    pushCandidate(store, "security", "Didomi", 95, "Didomi CMP detected");
  }

  if (hasRequest(requestUrls, ["axeptio"])) {
    pushCandidate(store, "security", "Axeptio", 95, "Axeptio CMP detected");
  }

  if (hasRequest(requestUrls, ["quantcast"])) {
    pushCandidate(store, "security", "Quantcast Choice", 95, "Quantcast CMP detected");
  }

  if (hasHtml(htmlLower, ["onetrust", "cookiebot", "didomi", "axeptio", "quantcast"])) {
    pushCandidate(store, "security", "Consent Management Platform", 60, "CMP markup/runtime detected");
  }

  if (hasRequest(requestUrls, ["app.usercentrics.eu"])) {
    pushCandidate(store, "security", "Usercentrics", 95, "Usercentrics CMP detected");
  }

  if (hasRequest(requestUrls, ["consent.trustarc.com"])) {
    pushCandidate(store, "security", "TrustArc", 95, "TrustArc CMP detected");
  }

  if (hasRequest(requestUrls, ["cdn.iubenda.com"])) {
    pushCandidate(store, "security", "Iubenda", 95, "Iubenda CMP detected");
  }

  if (hasRequest(requestUrls, ["cdn-cookieyes.com"])) {
    pushCandidate(store, "security", "CookieYes", 95, "CookieYes CMP detected");
  }

  if (hasRequest(requestUrls, ["hcaptcha.com"])) {
    pushCandidate(store, "security", "hCaptcha", 95, "hCaptcha detected");
  }

  if (hasRequest(requestUrls, ["challenges.cloudflare.com/turnstile"])) {
    pushCandidate(store, "security", "Cloudflare Turnstile", 95, "Cloudflare Turnstile CAPTCHA detected");
  }

  // =========================================================
  // RUNTIME GLOBALS — injected by Playwright window inspection
  // The route adds entries like "runtime:window.Shopify" to
  // enrichedRequests when the global exists at runtime.
  // =========================================================
  if (hasRequest(requestUrls, ["runtime:window.shopify", "runtime:shopifyanalytics"])) {
    pushCandidate(store, "platform", "Shopify", 90, "window.Shopify confirmed at runtime");
    pushCandidate(store, "ecommerce", "Shopify Storefront", 90, "window.Shopify confirmed at runtime");
  }

  if (hasRequest(requestUrls, ["runtime:gtag"])) {
    pushCandidate(store, "tracking", "Google Analytics 4 / GTM", 80, "gtag() confirmed at runtime");
  }

  if (hasRequest(requestUrls, ["runtime:fbq"])) {
    pushCandidate(store, "tracking", "Meta Pixel", 90, "fbq() confirmed at runtime");
  }

  if (hasRequest(requestUrls, ["runtime:datalayer"])) {
    pushCandidate(store, "tracking", "Google Tag Manager", 85, "dataLayer confirmed at runtime");
  }

  // =========================================================
  // COOKIE-BASED DETECTION
  // enrichedRequests contains cookie:name=value entries
  // =========================================================
  if (hasRequest(requestUrls, ["cookie:_shopify_y", "cookie:_shopify_s", "cookie:_shopify_sa"])) {
    pushCandidate(store, "platform", "Shopify", 85, "Shopify session cookie detected");
  }

  if (hasRequest(requestUrls, ["cookie:_ga", "cookie:_ga_"])) {
    pushCandidate(store, "tracking", "Google Analytics 4", 70, "GA cookie (_ga) detected");
  }

  if (hasRequest(requestUrls, ["cookie:_fbp", "cookie:_fbc"])) {
    pushCandidate(store, "tracking", "Meta Pixel", 75, "Meta Pixel cookie (_fbp/_fbc) detected");
  }

  if (hasRequest(requestUrls, ["cookie:_gcl_au", "cookie:_gcl_aw"])) {
    pushCandidate(store, "tracking", "Google Ads", 75, "Google Ads cookie (_gcl_au/_gcl_aw) detected");
  }

  if (hasRequest(requestUrls, ["cookie:_ttp", "cookie:_tt_enable_cookie"])) {
    pushCandidate(store, "tracking", "TikTok Pixel", 75, "TikTok Pixel cookie (_ttp) detected");
  }

  if (hasRequest(requestUrls, ["cookie:_scid", "cookie:_sctr"])) {
    pushCandidate(store, "tracking", "Snapchat Pixel", 75, "Snapchat cookie (_scid) detected");
  }

  // =========================================================
  // PLATFORM — WIX
  // =========================================================
  if (hasRequest(requestUrls, ["static.wixstatic.com", "wix-code-sdk", "wixstatic.com"])) {
    pushCandidate(store, "platform", "Wix", 90, "Wix CDN asset detected");
  }

  if (regex(htmlRaw, /wixsite\.com|wix-code|\.wixpress\.com|wixSiteProperties/i)) {
    pushCandidate(store, "platform", "Wix", 80, "Wix platform signature detected");
  }

  // =========================================================
  // PLATFORM — WEBFLOW
  // =========================================================
  if (hasRequest(requestUrls, ["webflow.com", "assets.website-files.com"])) {
    pushCandidate(store, "platform", "Webflow", 90, "Webflow asset detected");
  }

  if (regex(htmlRaw, /w-webflow-badge|data-wf-page|data-wf-site|webflow\.css/i)) {
    pushCandidate(store, "platform", "Webflow", 85, "Webflow DOM signature detected");
  }

  // =========================================================
  // PLATFORM — BIGCOMMERCE
  // =========================================================
  if (hasRequest(requestUrls, ["bigcommerce.com", "cdn11.bigcommerce.com", "stencil-utils"])) {
    pushCandidate(store, "platform", "BigCommerce", 90, "BigCommerce asset/CDN detected");
    pushCandidate(store, "ecommerce", "BigCommerce Storefront", 90, "BigCommerce platform detected");
  }

  if (regex(htmlRaw, /bigcommerce|stencil_utils|BCData\./i)) {
    pushCandidate(store, "platform", "BigCommerce", 75, "BigCommerce signature in HTML");
  }

  // =========================================================
  // PLATFORM — SQUARESPACE
  // =========================================================
  if (hasRequest(requestUrls, ["squarespace.com", "sqspcdn.com", "static1.squarespace.com"])) {
    pushCandidate(store, "platform", "Squarespace", 90, "Squarespace CDN asset detected");
  }

  if (regex(htmlRaw, /sqs-video-wrapper|squarespace\.com|Static\.SQUARESPACE_CONTEXT/i)) {
    pushCandidate(store, "platform", "Squarespace", 80, "Squarespace runtime signature detected");
  }

  // =========================================================
  // FRONTEND — NUXT.JS
  // =========================================================
  if (hasRequest(requestUrls, ["/_nuxt/"])) {
    pushCandidate(store, "frontend", "Nuxt.js", 90, "Nuxt.js static assets detected");
    pushCandidate(store, "frontend", "Vue.js", 70, "Nuxt.js implies Vue");
  }

  if (regex(htmlRaw, /__NUXT__|window\.__NUXT__|nuxt-link|<nuxt>/i)) {
    pushCandidate(store, "frontend", "Nuxt.js", 85, "Nuxt.js runtime object or component detected");
  }

  // =========================================================
  // FRONTEND — SVELTEKIT / SVELTE
  // =========================================================
  if (hasRequest(requestUrls, ["/_app/immutable/"])) {
    pushCandidate(store, "frontend", "SvelteKit", 90, "SvelteKit immutable asset detected");
  }

  if (regex(htmlRaw, /__sveltekit_data|sveltekit:data|svelte-announcer/i)) {
    pushCandidate(store, "frontend", "SvelteKit", 85, "SvelteKit signature detected");
  }

  if (regex(htmlRaw, /svelte-[\w]+|data-svelte/i)) {
    pushCandidate(store, "frontend", "Svelte", 60, "Svelte component marker detected");
  }

  // =========================================================
  // FRONTEND — GATSBY
  // =========================================================
  if (regex(htmlRaw, /___gatsby|GATSBY_BUILD_STAGE|gatsby-focus-wrapper/i)) {
    pushCandidate(store, "frontend", "Gatsby", 90, "Gatsby runtime object detected");
    pushCandidate(store, "frontend", "React", 70, "Gatsby implies React");
  }

  if (hasRequest(requestUrls, ["/gatsby-"])) {
    pushCandidate(store, "frontend", "Gatsby", 65, "Gatsby asset path detected");
  }

  // =========================================================
  // FRONTEND — ALPINE.JS
  // =========================================================
  if (hasRequest(requestUrls, ["alpinejs", "alpine.js", "alpine.min.js"])) {
    pushCandidate(store, "frontend", "Alpine.js", 85, "Alpine.js asset detected");
  }

  if (regex(htmlRaw, /\bx-data=|x-init=|x-show=|x-on:click=/i)) {
    pushCandidate(store, "frontend", "Alpine.js", 70, "Alpine.js directive detected");
  }

  // =========================================================
  // FRONTEND — GSAP (animation)
  // =========================================================
  if (hasRequest(requestUrls, ["gsap.min.js", "gsap-core", "cdnjs.cloudflare.com/ajax/libs/gsap"])) {
    pushCandidate(store, "frontend", "GSAP", 85, "GSAP animation library detected");
  }

  // =========================================================
  // TRACKING — TIKTOK PIXEL
  // =========================================================
  if (hasRequest(requestUrls, ["analytics.tiktok.com", "business-api.tiktok.com"])) {
    pushCandidate(store, "tracking", "TikTok Pixel", 95, "TikTok Pixel network request detected");
  }

  if (regex(htmlRaw, /ttq\.track|TiktokAnalyticsObject|ttq\.page|TikTok Pixel/i)) {
    pushCandidate(store, "tracking", "TikTok Pixel", 65, "TikTok Pixel script signature detected");
  }

  // =========================================================
  // TRACKING — SNAPCHAT PIXEL
  // =========================================================
  if (hasRequest(requestUrls, ["tr.snapchat.com", "sc-static.net/scevent.min.js"])) {
    pushCandidate(store, "tracking", "Snapchat Pixel", 95, "Snapchat Pixel network request detected");
  }

  if (regex(htmlRaw, /\bsnaptr\b|\bsnapchat pixel\b/i)) {
    pushCandidate(store, "tracking", "Snapchat Pixel", 55, "Snapchat Pixel script signature detected");
  }

  // =========================================================
  // TRACKING — PINTEREST TAG
  // =========================================================
  if (hasRequest(requestUrls, ["ct.pinterest.com", "s.pinimg.com/ct/core.js"])) {
    pushCandidate(store, "tracking", "Pinterest Tag", 95, "Pinterest Tag network request detected");
  }

  if (regex(htmlRaw, /\bpintrk\b|pinterest_tag|PinTag/i)) {
    pushCandidate(store, "tracking", "Pinterest Tag", 60, "Pinterest Tag script detected");
  }

  // =========================================================
  // TRACKING — TWITTER / X ADS PIXEL
  // =========================================================
  if (hasRequest(requestUrls, ["static.ads-twitter.com/uwt.js", "analytics.twitter.com"])) {
    pushCandidate(store, "tracking", "Twitter / X Pixel", 95, "Twitter Ads pixel network request detected");
  }

  if (regex(htmlRaw, /\btwq\s*\(|twitter_pixel|twttr\.conversion/i)) {
    pushCandidate(store, "tracking", "Twitter / X Pixel", 60, "Twitter Pixel script signature detected");
  }

  // =========================================================
  // TRACKING — LINKEDIN INSIGHT TAG
  // =========================================================
  if (hasRequest(requestUrls, ["snap.licdn.com/li.lms-analytics/insight.min.js"])) {
    pushCandidate(store, "tracking", "LinkedIn Insight Tag", 95, "LinkedIn Insight Tag detected");
  }

  if (regex(htmlRaw, /_linkedin_partner_id|linkedin_partner/i)) {
    pushCandidate(store, "tracking", "LinkedIn Insight Tag", 65, "LinkedIn Insight partner ID detected");
  }

  // =========================================================
  // TRACKING — BING / MICROSOFT ADS
  // =========================================================
  if (hasRequest(requestUrls, ["bat.bing.com", "bat.r.msn.com"])) {
    pushCandidate(store, "tracking", "Microsoft / Bing Ads", 95, "Bing UET network request detected");
  }

  if (regex(htmlRaw, /\buetq\b|microsoft\.com\/bat\.js/i)) {
    pushCandidate(store, "tracking", "Microsoft / Bing Ads", 60, "Bing UET script signature detected");
  }

  // =========================================================
  // TRACKING — CRITEO
  // =========================================================
  if (hasRequest(requestUrls, ["static.criteo.net", "rtax.criteo.com", "cas.criteo.com"])) {
    pushCandidate(store, "tracking", "Criteo", 95, "Criteo network request detected");
  }

  if (regex(htmlRaw, /\bcriteo_q\b|window\.criteo_q|CriteoId/i)) {
    pushCandidate(store, "tracking", "Criteo", 65, "Criteo script signature detected");
  }

  // =========================================================
  // TRACKING — HEAP ANALYTICS
  // =========================================================
  if (hasRequest(requestUrls, ["heapanalytics.com", "cdn.heapanalytics.com"])) {
    pushCandidate(store, "tracking", "Heap Analytics", 90, "Heap Analytics detected");
  }

  // =========================================================
  // TRACKING — MIXPANEL
  // =========================================================
  if (hasRequest(requestUrls, ["cdn.mxpnl.com", "api.mixpanel.com"])) {
    pushCandidate(store, "tracking", "Mixpanel", 90, "Mixpanel detected");
  }

  // =========================================================
  // TRACKING — AMPLITUDE
  // =========================================================
  if (hasRequest(requestUrls, ["cdn.amplitude.com", "api.amplitude.com"])) {
    pushCandidate(store, "tracking", "Amplitude", 90, "Amplitude analytics detected");
  }

  // =========================================================
  // TRACKING — POSTHOG
  // =========================================================
  if (hasRequest(requestUrls, ["posthog.com", "app.posthog.com"])) {
    pushCandidate(store, "tracking", "PostHog", 90, "PostHog analytics detected");
  }

  // =========================================================
  // INFRASTRUCTURE — VERCEL
  // =========================================================
  if (hasRequest(requestUrls, ["vercel.app", "_vercel", "vercel.com"])) {
    pushCandidate(store, "infrastructure", "Vercel", 85, "Vercel deployment detected");
  }

  if (regex(htmlRaw, /__NEXT_DATA__|_vercel|vercel\.live/i)) {
    pushCandidate(store, "infrastructure", "Vercel", 60, "Vercel marker detected in HTML");
  }

  // =========================================================
  // INFRASTRUCTURE — NETLIFY
  // =========================================================
  if (hasRequest(requestUrls, ["netlify.app", "netlify.com", "netlify.live"])) {
    pushCandidate(store, "infrastructure", "Netlify", 85, "Netlify deployment detected");
  }

  if (regex(htmlRaw, /netlify/i)) {
    pushCandidate(store, "infrastructure", "Netlify", 45, "Netlify reference in HTML");
  }

  // =========================================================
  // INFRASTRUCTURE — AKAMAI
  // =========================================================
  if (hasRequest(requestUrls, ["akamaized.net", "akamaihd.net", "akamaiapis.net"])) {
    pushCandidate(store, "infrastructure", "Akamai", 90, "Akamai CDN asset detected");
  }

  // =========================================================
  // ECOMMERCE — PAYMENTS & BNPL
  // =========================================================
  if (hasRequest(requestUrls, ["x.klarnacdn.net", "klarna.com/direct"])) {
    pushCandidate(store, "ecommerce", "Klarna", 95, "Klarna payment widget detected");
  }

  if (hasHtml(htmlLower, ["klarna"])) {
    pushCandidate(store, "ecommerce", "Klarna", 45, "Klarna keyword detected");
  }

  if (hasRequest(requestUrls, ["checkoutshopper-live.adyen.com", "adyen.com"])) {
    pushCandidate(store, "ecommerce", "Adyen", 95, "Adyen payment SDK detected");
  }

  if (hasRequest(requestUrls, ["js.afterpay.com", "portal.afterpay.com"])) {
    pushCandidate(store, "ecommerce", "Afterpay / Clearpay", 95, "Afterpay SDK detected");
  }

  // =========================================================
  // ECOMMERCE — REVIEWS & SOCIAL PROOF
  // =========================================================
  if (hasRequest(requestUrls, ["widget.trustpilot.com", "invitations.trustpilot.com"])) {
    pushCandidate(store, "ecommerce", "Trustpilot", 95, "Trustpilot widget detected");
  }

  if (hasRequest(requestUrls, ["staticw2.yotpo.com", "api.yotpo.com"])) {
    pushCandidate(store, "ecommerce", "Yotpo", 95, "Yotpo reviews widget detected");
  }

  if (hasRequest(requestUrls, ["stamped.io", "cdn1.stamped.io"])) {
    pushCandidate(store, "ecommerce", "Stamped.io", 90, "Stamped reviews detected");
  }

  // =========================================================
  // ECOMMERCE — LIVE CHAT / SUPPORT
  // =========================================================
  if (hasRequest(requestUrls, ["config.gorgias.chat", "gorgias.com"])) {
    pushCandidate(store, "ecommerce", "Gorgias", 95, "Gorgias chat widget detected");
  }

  if (hasRequest(requestUrls, ["code.tidio.co"])) {
    pushCandidate(store, "ecommerce", "Tidio", 95, "Tidio chat widget detected");
  }

  if (hasRequest(requestUrls, ["client.crisp.chat"])) {
    pushCandidate(store, "ecommerce", "Crisp", 95, "Crisp chat widget detected");
  }

  return {
    platform: finalizeBucket(store, "platform"),
    frontend: finalizeBucket(store, "frontend"),
    ecommerce: finalizeBucket(store, "ecommerce"),
    tracking: finalizeBucket(store, "tracking"),
    infrastructure: finalizeBucket(store, "infrastructure"),
    security: finalizeBucket(store, "security"),
  };
}