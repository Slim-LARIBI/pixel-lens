import { ScanProfile } from "@prisma/client";
import { ScanResult, Finding, PageStep, EventData, CategoryScore } from "./types";

function generateProductName(): string {
  const products = [
    "Blue Sneakers",
    "Organic Cotton T-Shirt",
    "Wireless Headphones",
    "Coffee Maker Pro",
    "Yoga Mat Premium",
  ];
  return products[Math.floor(Math.random() * products.length)];
}

function generateRandomString(length: number): string {
  return Math.random().toString(36).substring(2, 2 + length);
}

function generateFindings(profile: ScanProfile): Finding[] {
  const findings: Finding[] = [];

  // CRITICAL: Missing purchase items
  if (profile !== ScanProfile.QUICK) {
    findings.push({
      id: generateRandomString(8),
      severity: "CRITICAL",
      category: "GA4",
      title: "Purchase event missing items array",
      description:
        "The purchase event was fired without the required 'items' array. This means Google Analytics cannot attribute revenue to specific products.",
      evidence: "purchase event on /thank-you page",
      affectedSteps: ["/thank-you"],
      impact: {
        analytics: "Revenue is recorded but not attributed to products. Impossible to analyze product performance.",
        ads: "Google Ads cannot optimize for specific products, reducing ROAS by 15-30%.",
      },
      howToFix:
        "Ensure the purchase event includes an 'items' array with item_id, item_name, price, and quantity for each product.",
      codeSnippet: `gtag('event', 'purchase', {
  transaction_id: 'T_12345',
  value: 49.99,
  currency: 'USD',
  items: [{
    item_id: 'SKU_123',
    item_name: 'Blue Sneakers',
    price: 49.99,
    quantity: 1
  }]
});`,
    });
  }

  // HIGH: view_item missing item_category
  findings.push({
    id: generateRandomString(8),
    severity: "HIGH",
    category: "GA4",
    title: "view_item event missing item_category",
    description:
      "Product view events lack category information, preventing proper funnel analysis by product category.",
    evidence: "view_item event on /p/product-123",
    affectedSteps: ["/p/product-123"],
    impact: {
      analytics: "Cannot segment conversion rates by category. Merchandising insights limited.",
      ads: "Dynamic remarketing less effective without category data.",
    },
    howToFix: "Add item_category, item_category2, etc. to all item parameters.",
    codeSnippet: `items: [{
  item_id: 'SKU_123',
  item_name: 'Blue Sneakers',
  item_category: 'Footwear',
  item_category2: 'Athletic',
  price: 49.99
}]`,
  });

  // HIGH: Meta content_ids as string instead of array
  findings.push({
    id: generateRandomString(8),
    severity: "HIGH",
    category: "META",
    title: "Meta Pixel content_ids sent as string instead of array",
    description:
      "The Facebook Pixel expects content_ids as an array, but your implementation sends it as a string. This breaks product catalog matching.",
    evidence: "ViewContent event on /p/product-123",
    affectedSteps: ["/p/product-123"],
    impact: {
      ads: "Dynamic ads cannot match products to catalog. Carousel ads show wrong products or fail to display.",
    },
    howToFix: "Always wrap content_ids in an array, even for single products.",
    codeSnippet: `fbq('track', 'ViewContent', {
  content_ids: ['SKU_123'], // Array, not 'SKU_123'
  content_type: 'product',
  value: 49.99,
  currency: 'USD'
});`,
  });

  // MEDIUM: Currency mismatch
  if (profile === ScanProfile.DEEP) {
    findings.push({
      id: generateRandomString(8),
      severity: "MEDIUM",
      category: "GA4",
      title: "Currency parameter inconsistent across events",
      description: "Some events use 'USD' while others use 'usd' (lowercase). This can cause reporting discrepancies.",
      evidence: "view_item uses 'USD', add_to_cart uses 'usd'",
      affectedSteps: ["/p/product-123", "/cart"],
      impact: {
        analytics: "Currency conversion may fail, leading to inaccurate revenue reports.",
      },
      howToFix: "Standardize on uppercase currency codes (USD, EUR, GBP) across all events.",
      codeSnippet: `// Always use uppercase
currency: 'USD' // not 'usd'`,
    });
  }

  // MEDIUM: Consent blocks Meta
  findings.push({
    id: generateRandomString(8),
    severity: "MEDIUM",
    category: "CONSENT",
    title: "Meta Pixel blocked until explicit consent",
    description:
      "Meta Pixel is correctly waiting for marketing consent, but this delays event firing by 2-8 seconds on average, causing event loss.",
    evidence: "PageView event delayed on homepage",
    affectedSteps: ["/"],
    impact: {
      ads: "10-25% of sessions don't grant consent before leaving. These users are not tracked for retargeting.",
    },
    howToFix:
      "Consider using Meta's Limited Data Use mode to fire basic events before consent, or improve consent UI prominence.",
      codeSnippet: `// Option 1: Fire PageView immediately with limited data
fbq('dataProcessingOptions', ['LDU'], 1, 1000);
fbq('track', 'PageView');`,
    });

  // CRITICAL: CAPI missing event_id
  if (profile !== ScanProfile.QUICK) {
    findings.push({
      id: generateRandomString(8),
      severity: "CRITICAL",
      category: "CAPI",
      title: "Conversion API missing event_id for deduplication",
      description:
        "Server-side events lack event_id, meaning browser and server events cannot be deduplicated. You're double-counting conversions.",
      evidence: "Purchase event sent both client and server",
      affectedSteps: ["/thank-you"],
      impact: {
        ads: "Conversions are counted twice. Your actual ROAS is 1.8x, not the reported 3.2x. This leads to over-bidding.",
      },
      howToFix:
        "Generate a unique event_id client-side and send it with both Pixel and CAPI events. Meta will deduplicate automatically.",
      codeSnippet: `// Client-side
const eventId = 'evt_' + Date.now() + '_' + Math.random();
fbq('track', 'Purchase', data, { eventID: eventId });

// Server-side (send eventId to your backend)
await fetch('/api/meta-capi', {
  body: JSON.stringify({ ...data, event_id: eventId })
});`,
    });
  }

  // LOW: Duplicate events
  if (profile === ScanProfile.DEEP) {
    findings.push({
      id: generateRandomString(8),
      severity: "LOW",
      category: "GTM",
      title: "page_view event firing twice on homepage",
      description: "GTM configuration triggers page_view twice: once from default tag, once from custom trigger.",
      evidence: "Two page_view events within 100ms on /",
      affectedSteps: ["/"],
      impact: {
        analytics: "Pageview metrics inflated by 2x. Bounce rate calculated incorrectly.",
      },
      howToFix: "Review GTM triggers. Ensure only one tag fires page_view on Page View - All Pages.",
      codeSnippet: `// Check GTM:
// 1. Tags > GA4 Configuration > Triggers
// 2. Ensure only ONE trigger for page_view
// 3. Remove duplicate custom page_view tags`,
    });
  }

  // INFO: Good practice
  findings.push({
    id: generateRandomString(8),
    severity: "INFO",
    category: "GA4",
    title: "Enhanced measurement enabled",
    description: "Enhanced measurement is active, automatically tracking scrolls, outbound clicks, and video engagement.",
    evidence: "scroll events detected",
    affectedSteps: ["all"],
    impact: {
      analytics: "Rich behavioral data collected without custom code.",
    },
    howToFix: "No action needed. Consider disabling if you have custom scroll tracking to avoid duplication.",
  });

  return findings;
}

function generateEventsTimeline(profile: ScanProfile, productName: string): PageStep[] {
  const timeline: PageStep[] = [];

  // Homepage
  timeline.push({
    page: "Homepage",
    url: "/",
    consentState: { analytics: false, marketing: false },
    events: [
      {
        type: "DATALAYER",
        name: "page_data",
        timestamp: Date.now(),
        params: {
          page_type: "home",
          user_id: null,
        },
      },
      {
        type: "GA4",
        name: "page_view",
        timestamp: Date.now() + 50,
        params: {
          page_title: "Home - PixelLens Demo Store",
          page_location: "https://example.com/",
        },
      },
      {
        type: "GA4",
        name: "page_view",
        timestamp: Date.now() + 120,
        params: {
          page_title: "Home - PixelLens Demo Store",
          page_location: "https://example.com/",
        },
        issues: ["Duplicate event - fires twice"],
      },
    ],
  });

  // After consent granted
  timeline.push({
    page: "Homepage (after consent)",
    url: "/",
    consentState: { analytics: true, marketing: true },
    events: [
      {
        type: "META",
        name: "PageView",
        timestamp: Date.now() + 2500,
        params: {},
        issues: ["Delayed 2.5s waiting for consent"],
      },
    ],
  });

  // Category page
  if (profile !== ScanProfile.QUICK) {
    timeline.push({
      page: "Category",
      url: "/c/footwear",
      consentState: { analytics: true, marketing: true },
      events: [
        {
          type: "GA4",
          name: "page_view",
          timestamp: Date.now() + 5000,
          params: {
            page_title: "Footwear - PixelLens Demo Store",
          },
        },
        {
          type: "META",
          name: "PageView",
          timestamp: Date.now() + 5100,
          params: {},
        },
      ],
    });
  }

  // Product page
  timeline.push({
    page: "Product",
    url: "/p/product-123",
    consentState: { analytics: true, marketing: true },
    events: [
      {
        type: "GA4",
        name: "view_item",
        timestamp: Date.now() + 8000,
        params: {
          currency: "USD",
          value: 49.99,
          items: [
            {
              item_id: "SKU_123",
              item_name: productName,
              // item_category missing
              price: 49.99,
            },
          ],
        },
        issues: ["Missing item_category"],
      },
      {
        type: "META",
        name: "ViewContent",
        timestamp: Date.now() + 8100,
        params: {
          content_ids: "SKU_123", // Should be array
          content_type: "product",
          value: 49.99,
          currency: "USD",
        },
        issues: ["content_ids should be array"],
      },
    ],
  });

  // Add to cart
  timeline.push({
    page: "Product",
    url: "/p/product-123",
    consentState: { analytics: true, marketing: true },
    events: [
      {
        type: "GA4",
        name: "add_to_cart",
        timestamp: Date.now() + 12000,
        params: {
          currency: "usd", // Inconsistent casing
          value: 49.99,
          items: [
            {
              item_id: "SKU_123",
              item_name: productName,
              price: 49.99,
              quantity: 1,
            },
          ],
        },
        issues: profile === ScanProfile.DEEP ? ["Currency should be uppercase 'USD'"] : undefined,
      },
      {
        type: "META",
        name: "AddToCart",
        timestamp: Date.now() + 12100,
        params: {
          content_ids: ["SKU_123"],
          value: 49.99,
          currency: "USD",
        },
      },
    ],
  });

  // Checkout
  timeline.push({
    page: "Checkout",
    url: "/checkout",
    consentState: { analytics: true, marketing: true },
    events: [
      {
        type: "GA4",
        name: "begin_checkout",
        timestamp: Date.now() + 18000,
        params: {
          currency: "USD",
          value: 49.99,
          items: [
            {
              item_id: "SKU_123",
              item_name: productName,
              price: 49.99,
              quantity: 1,
            },
          ],
        },
      },
      {
        type: "META",
        name: "InitiateCheckout",
        timestamp: Date.now() + 18100,
        params: {
          content_ids: ["SKU_123"],
          value: 49.99,
          currency: "USD",
        },
      },
    ],
  });

  // Purchase
  timeline.push({
    page: "Thank You",
    url: "/thank-you",
    consentState: { analytics: true, marketing: true },
    events: [
      {
        type: "GA4",
        name: "purchase",
        timestamp: Date.now() + 25000,
        params: {
          transaction_id: "T_" + Date.now(),
          value: 49.99,
          currency: "USD",
          // items missing!
        },
        issues: profile !== ScanProfile.QUICK ? ["Missing items array - critical for attribution"] : undefined,
      },
      {
        type: "META",
        name: "Purchase",
        timestamp: Date.now() + 25100,
        params: {
          content_ids: ["SKU_123"],
          value: 49.99,
          currency: "USD",
        },
      },
      {
        type: "META",
        name: "Purchase (CAPI)",
        timestamp: Date.now() + 25200,
        params: {
          content_ids: ["SKU_123"],
          value: 49.99,
          currency: "USD",
          // event_id missing for deduplication
        },
        issues: profile !== ScanProfile.QUICK ? ["Missing event_id - causes double-counting with Pixel"] : undefined,
      },
    ],
  });

  return timeline;
}

function calculateCategoryScore(findings: Finding[], category: string): CategoryScore {
  const categoryFindings = findings.filter((f) => f.category === category.toUpperCase());

  let deductions = 0;
  categoryFindings.forEach((f) => {
    switch (f.severity) {
      case "CRITICAL":
        deductions += 30;
        break;
      case "HIGH":
        deductions += 20;
        break;
      case "MEDIUM":
        deductions += 10;
        break;
      case "LOW":
        deductions += 5;
        break;
      case "INFO":
        deductions += 0;
        break;
    }
  });

  const score = Math.max(0, 100 - deductions);

  let status: CategoryScore["status"];
  if (score >= 90) status = "EXCELLENT";
  else if (score >= 75) status = "GOOD";
  else if (score >= 50) status = "NEEDS_WORK";
  else status = "CRITICAL";

  return {
    score,
    maxScore: 100,
    status,
  };
}

function generateExecutiveSummary(findings: Finding[], overallScore: number): string {
  const critical = findings.filter((f) => f.severity === "CRITICAL").length;
  const high = findings.filter((f) => f.severity === "HIGH").length;
  const medium = findings.filter((f) => f.severity === "MEDIUM").length;

  const bullets = [
    `**Overall Score: ${overallScore}/100** - ${
      overallScore >= 75 ? "Good foundation with room for optimization" : "Critical issues impacting ROI"
    }`,
    critical > 0
      ? `**${critical} Critical Issue${critical > 1 ? "s" : ""}** - These directly reduce ROAS and must be fixed immediately`
      : null,
    high > 0
      ? `**${high} High Priority Issue${high > 1 ? "s" : ""}** - Significant impact on attribution and audience quality`
      : null,
    medium > 0
      ? `**${medium} Medium Priority Issue${medium > 1 ? "s" : ""}** - Data quality issues that affect reporting accuracy`
      : null,
    "**GA4 Implementation** - Core events fire, but missing critical parameters for product attribution",
    "**Meta Pixel** - Tracking present but data format issues break dynamic ads catalog matching",
    "**Consent Management** - Working, but delays cause 10-25% event loss before user interaction",
    "**Conversion API** - Server-side events fire but missing deduplication, inflating conversion metrics by ~2x",
    "**GTM Configuration** - Some duplicate triggers inflate pageview counts",
    "",
    "### Recommended Action Plan",
    "",
    "**Now (1-7 days)** - Fix critical issues:",
    "- Add items array to purchase events",
    "- Add event_id to CAPI for deduplication",
    "- Fix Meta Pixel content_ids format",
    "",
    "**Next (2-4 weeks)** - Address high priority:",
    "- Add item_category to all product events",
    "- Standardize currency parameter casing",
    "- Review consent UI to reduce friction",
    "",
    "**Later (6-12 weeks)** - Optimize:",
    "- Clean up GTM duplicate triggers",
    "- Implement advanced ecommerce parameters",
    "- Add server-side enrichment for better attribution",
  ];

  return bullets.filter(Boolean).join("\n");
}

export async function mockScan(url: string, profile: ScanProfile): Promise<ScanResult> {
  // Simulate scan time
  await new Promise((resolve) => setTimeout(resolve, profile === ScanProfile.DEEP ? 3000 : 1500));

  const productName = generateProductName();
  const findings = generateFindings(profile);
  const eventsTimeline = generateEventsTimeline(profile, productName);

  const categoryScores = {
    ga4: calculateCategoryScore(findings, "GA4"),
    gtm: calculateCategoryScore(findings, "GTM"),
    meta: calculateCategoryScore(findings, "META"),
    consent: calculateCategoryScore(findings, "CONSENT"),
    capi: calculateCategoryScore(findings, "CAPI"),
  };

  // Calculate weighted overall score
  const overallScore = Math.round(
    categoryScores.ga4.score * 0.3 +
      categoryScores.gtm.score * 0.15 +
      categoryScores.meta.score * 0.3 +
      categoryScores.consent.score * 0.15 +
      categoryScores.capi.score * 0.1
  );

  const executiveSummary = generateExecutiveSummary(findings, overallScore);

  return {
    overallScore,
    categoryScores,
    executiveSummary,
    findings,
    eventsTimeline,
    payloads: {
      ga4Events: eventsTimeline.flatMap((step) => step.events.filter((e) => e.type === "GA4")),
      metaEvents: eventsTimeline.flatMap((step) => step.events.filter((e) => e.type === "META")),
      dataLayerSnapshots: eventsTimeline.flatMap((step) => step.events.filter((e) => e.type === "DATALAYER")),
      consentSignals: [
        { timestamp: Date.now(), analytics: false, marketing: false },
        { timestamp: Date.now() + 2500, analytics: true, marketing: true },
      ],
    },
    raw: {
      scanUrl: url,
      profile,
      scanDuration: profile === ScanProfile.DEEP ? 3000 : 1500,
      pagesScanned: eventsTimeline.length,
      eventsCollected: eventsTimeline.reduce((sum, step) => sum + step.events.length, 0),
    },
  };
}
