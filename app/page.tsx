import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  CheckCircle2,
  AlertTriangle,
  Shield,
  Zap,
  BarChart3,
  Share2,
  GitBranch,
  Radar,
  Activity,
  ChevronRight,
  SearchCheck,
  Workflow,
  LineChart,
} from "lucide-react";

export default function LandingPage() {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b bg-background/80 backdrop-blur">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
              <Radar className="h-5 w-5" />
            </div>
            <div>
              <div className="text-lg font-bold leading-none">PixelLens</div>
              <div className="text-xs text-muted-foreground">
                Tracking Intelligence Platform
              </div>
            </div>
          </div>

          <nav className="hidden items-center gap-6 md:flex">
            <Link href="#features" className="text-sm font-medium text-muted-foreground transition hover:text-foreground">
              Features
            </Link>
            <Link href="#how-it-works" className="text-sm font-medium text-muted-foreground transition hover:text-foreground">
              How it works
            </Link>
            <Link href="#pricing" className="text-sm font-medium text-muted-foreground transition hover:text-foreground">
              Pricing
            </Link>
            <Link href="/login" className="text-sm font-medium text-muted-foreground transition hover:text-foreground">
              Login
            </Link>
          </nav>

          <div className="flex items-center gap-2">
            <Link href="/app/shared/demo">
              <Button variant="outline" className="hidden sm:inline-flex">
                Sample Report
              </Button>
            </Link>
            <Link href="/login">
              <Button>Start Free Audit</Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-primary/5 via-background to-background" />
        <div className="container relative mx-auto px-4 py-20 md:py-28">
          <div className="grid items-center gap-12 lg:grid-cols-2">
            <div className="max-w-2xl">
              <Badge className="mb-5 rounded-full px-3 py-1 text-xs">
                Audit GA4 • GTM • Meta Pixel • Consent • CAPI
              </Badge>

              <h1 className="text-4xl font-bold tracking-tight md:text-6xl">
                Find the tracking issues
                <span className="block text-primary">that silently kill ROAS</span>
              </h1>

              <p className="mt-6 max-w-xl text-lg leading-8 text-muted-foreground md:text-xl">
                PixelLens audits your ecommerce tracking stack, validates critical events,
                maps your tracking architecture, and turns broken analytics into a clear action plan.
              </p>

              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Link href="/login">
                  <Button size="lg" className="w-full sm:w-auto">
                    Start Free Audit
                  </Button>
                </Link>

                <Link href="/app/shared/demo">
                  <Button size="lg" variant="outline" className="w-full sm:w-auto">
                    View Sample Report
                  </Button>
                </Link>
              </div>

              <div className="mt-8 grid gap-3 sm:grid-cols-3">
                <div className="rounded-2xl border bg-background/70 p-4 shadow-sm">
                  <div className="text-2xl font-bold">5 min</div>
                  <div className="text-sm text-muted-foreground">to first audit</div>
                </div>
                <div className="rounded-2xl border bg-background/70 p-4 shadow-sm">
                  <div className="text-2xl font-bold">1 score</div>
                  <div className="text-sm text-muted-foreground">tracking health overview</div>
                </div>
                <div className="rounded-2xl border bg-background/70 p-4 shadow-sm">
                  <div className="text-2xl font-bold">1 link</div>
                  <div className="text-sm text-muted-foreground">to share with clients</div>
                </div>
              </div>
            </div>

            {/* Hero Visual */}
            <div className="relative">
              <div className="rounded-3xl border bg-card p-5 shadow-2xl">
                <div className="mb-4 flex items-center justify-between">
                  <div>
                    <div className="text-sm font-semibold">Tracking Health Report</div>
                    <div className="text-xs text-muted-foreground">
                      Runtime scan + architecture graph + funnel validation
                    </div>
                  </div>
                  <Badge variant="secondary">Live Preview</Badge>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <Card className="rounded-2xl border shadow-none">
                    <CardContent className="p-4">
                      <div className="text-sm text-muted-foreground">Tracking Health Score</div>
                      <div className="mt-2 text-4xl font-bold">84</div>
                      <div className="mt-3 h-2 rounded-full bg-muted">
                        <div className="h-2 w-[84%] rounded-full bg-primary" />
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="rounded-2xl border shadow-none">
                    <CardContent className="p-4">
                      <div className="text-sm text-muted-foreground">Main Risk</div>
                      <div className="mt-2 text-base font-semibold">Consent not detected</div>
                      <div className="mt-2 text-sm text-muted-foreground">
                        Data loss risk on ads attribution and analytics quality.
                      </div>
                    </CardContent>
                  </Card>
                </div>

                <div className="mt-4 grid gap-3 md:grid-cols-5">
                  {[
                    ["GA4", "85"],
                    ["GTM", "100"],
                    ["Meta", "80"],
                    ["Consent", "0"],
                    ["CAPI", "0"],
                  ].map(([label, value]) => (
                    <div key={label} className="rounded-2xl border p-3 text-center">
                      <div className="text-xs text-muted-foreground">{label}</div>
                      <div className="mt-1 text-xl font-bold">{value}</div>
                    </div>
                  ))}
                </div>

                <div className="mt-5 rounded-2xl border p-4">
                  <div className="mb-3 flex items-center justify-between">
                    <div className="text-sm font-semibold">Architecture Snapshot</div>
                    <div className="text-xs text-muted-foreground">Visual audit</div>
                  </div>

                  <div className="grid gap-3 md:grid-cols-3">
                    <div className="rounded-xl border bg-slate-900 p-3 text-center text-sm font-medium text-white">
                      Website
                    </div>
                    <div className="rounded-xl border bg-slate-700 p-3 text-center text-sm font-medium text-white">
                      dataLayer
                    </div>
                    <div className="rounded-xl border bg-green-50 p-3 text-center text-sm font-medium text-green-700">
                      GTM • 100
                    </div>
                    <div className="rounded-xl border bg-green-50 p-3 text-center text-sm font-medium text-green-700">
                      GA4 • 85
                    </div>
                    <div className="rounded-xl border bg-green-50 p-3 text-center text-sm font-medium text-green-700">
                      Meta • 80
                    </div>
                    <div className="rounded-xl border bg-red-50 p-3 text-center text-sm font-medium text-red-700">
                      CAPI • 0
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Proof / Pain */}
      <section className="border-y bg-muted/40 py-20">
        <div className="container mx-auto px-4">
          <div className="mx-auto mb-12 max-w-3xl text-center">
            <h2 className="text-3xl font-bold md:text-4xl">
              Most tracking stacks look “installed”
              <span className="block text-primary">but are still broken in production</span>
            </h2>
            <p className="mt-4 text-muted-foreground">
              PixelLens focuses on what really matters: event quality, payload integrity,
              attribution reliability, and real ecommerce tracking coverage.
            </p>
          </div>

          <div className="grid gap-8 md:grid-cols-3">
            <Card className="rounded-3xl border shadow-sm">
              <CardContent className="p-6">
                <AlertTriangle className="mb-4 h-10 w-10 text-amber-500" />
                <h3 className="text-lg font-semibold">Missing Product Payloads</h3>
                <p className="mt-3 text-sm leading-7 text-muted-foreground">
                  Events fire, but item arrays, value, currency, or content_ids are missing.
                  Ads platforms cannot optimize properly and revenue attribution becomes unreliable.
                </p>
              </CardContent>
            </Card>

            <Card className="rounded-3xl border shadow-sm">
              <CardContent className="p-6">
                <AlertTriangle className="mb-4 h-10 w-10 text-amber-500" />
                <h3 className="text-lg font-semibold">False Confidence in ROAS</h3>
                <p className="mt-3 text-sm leading-7 text-muted-foreground">
                  Browser pixel, server events, or duplicate tags can inflate reported performance.
                  What looks like strong ROAS may actually be broken measurement.
                </p>
              </CardContent>
            </Card>

            <Card className="rounded-3xl border shadow-sm">
              <CardContent className="p-6">
                <AlertTriangle className="mb-4 h-10 w-10 text-amber-500" />
                <h3 className="text-lg font-semibold">Consent & Attribution Loss</h3>
                <p className="mt-3 text-sm leading-7 text-muted-foreground">
                  Missing consent mode or incomplete server-side architecture creates silent data loss,
                  especially on Meta, GA4, and conversion reporting.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how-it-works" className="py-20">
        <div className="container mx-auto px-4">
          <div className="mx-auto mb-12 max-w-3xl text-center">
            <h2 className="text-3xl font-bold md:text-4xl">How PixelLens works</h2>
            <p className="mt-4 text-muted-foreground">
              From URL to actionable diagnosis in a few steps.
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-4">
            {[
              {
                step: "1",
                title: "Scan your store",
                desc: "Enter your ecommerce URL and launch a runtime audit.",
              },
              {
                step: "2",
                title: "Map the stack",
                desc: "We detect GTM, GA4, Meta Pixel, Consent, CAPI, and event signals.",
              },
              {
                step: "3",
                title: "Validate the funnel",
                desc: "PixelLens checks product, cart, checkout, and purchase tracking coverage.",
              },
              {
                step: "4",
                title: "Share the report",
                desc: "Send a clean read-only report to clients, media buyers, or developers.",
              },
            ].map((item) => (
              <Card key={item.step} className="rounded-3xl border shadow-sm">
                <CardContent className="p-6 text-center">
                  <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary text-lg font-bold text-primary-foreground">
                    {item.step}
                  </div>
                  <h3 className="font-semibold">{item.title}</h3>
                  <p className="mt-3 text-sm leading-7 text-muted-foreground">{item.desc}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="border-y bg-muted/40 py-20">
        <div className="container mx-auto px-4">
          <div className="mx-auto mb-12 max-w-3xl text-center">
            <h2 className="text-3xl font-bold md:text-4xl">
              Built for teams who need more than a pixel checker
            </h2>
            <p className="mt-4 text-muted-foreground">
              PixelLens combines technical inspection, visual diagnostics, and business-focused reporting.
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            {[
              {
                icon: <BarChart3 className="h-8 w-8 text-primary" />,
                title: "Tracking Health Score",
                desc: "One clear score to understand the overall quality of your tracking stack.",
              },
              {
                icon: <GitBranch className="h-8 w-8 text-primary" />,
                title: "Architecture Graph",
                desc: "Visualize the flow between website, dataLayer, GTM, GA4, Meta, server-side and more.",
              },
              {
                icon: <Activity className="h-8 w-8 text-primary" />,
                title: "Timeline Pro",
                desc: "See journey events, technical traces, and runtime evidence in one place.",
              },
              {
                icon: <Workflow className="h-8 w-8 text-primary" />,
                title: "Ecommerce Funnel Validation",
                desc: "Validate view_item, add_to_cart, checkout and purchase coverage step by step.",
              },
              {
                icon: <SearchCheck className="h-8 w-8 text-primary" />,
                title: "Payload & Event Inspection",
                desc: "Go beyond detection and verify the quality of event payloads and parameter structure.",
              },
              {
                icon: <Share2 className="h-8 w-8 text-primary" />,
                title: "Shareable Audit Reports",
                desc: "Generate a clean report that clients, developers, and performance teams can understand.",
              },
              {
                icon: <Shield className="h-8 w-8 text-primary" />,
                title: "Agency-Ready Reporting",
                desc: "Present your audit work professionally with a polished interface and repeatable process.",
              },
              {
                icon: <Zap className="h-8 w-8 text-primary" />,
                title: "Prioritized Fix Plan",
                desc: "Focus on the issues that have the highest impact on attribution and ROAS.",
              },
              {
                icon: <LineChart className="h-8 w-8 text-primary" />,
                title: "Progress Tracking",
                desc: "Compare scans over time to verify fixes and prove measurement improvement.",
              },
            ].map((item) => (
              <Card key={item.title} className="rounded-3xl border shadow-sm transition hover:-translate-y-1 hover:shadow-lg">
                <CardContent className="p-6">
                  <div className="mb-4">{item.icon}</div>
                  <h3 className="text-lg font-semibold">{item.title}</h3>
                  <p className="mt-3 text-sm leading-7 text-muted-foreground">{item.desc}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Positioning */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <div className="grid gap-8 lg:grid-cols-2">
            <Card className="rounded-3xl border shadow-sm">
              <CardContent className="p-8">
                <Badge variant="secondary" className="mb-4">
                  For ecommerce teams
                </Badge>
                <h3 className="text-2xl font-bold">Make ad platforms trust your data again</h3>
                <p className="mt-4 text-muted-foreground">
                  PixelLens helps performance marketers, ecommerce managers, and growth teams
                  fix the measurement problems that block optimization and distort ROAS.
                </p>
                <ul className="mt-6 space-y-3 text-sm text-muted-foreground">
                  {[
                    "Detect broken or missing ecommerce events",
                    "Validate tracking architecture before scaling budget",
                    "Share clean reports with developers and stakeholders",
                  ].map((item) => (
                    <li key={item} className="flex items-start gap-2">
                      <CheckCircle2 className="mt-0.5 h-5 w-5 text-green-600" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>

            <Card className="rounded-3xl border shadow-sm">
              <CardContent className="p-8">
                <Badge variant="secondary" className="mb-4">
                  For agencies
                </Badge>
                <h3 className="text-2xl font-bold">Turn tracking audits into a repeatable service</h3>
                <p className="mt-4 text-muted-foreground">
                  Standardize how you audit, present, and follow up on measurement quality across multiple clients.
                </p>
                <ul className="mt-6 space-y-3 text-sm text-muted-foreground">
                  {[
                    "Use one framework for all client audits",
                    "Visualize GTM, GA4, Meta and server-side architecture",
                    "Prove progress with scan history and health scores",
                  ].map((item) => (
                    <li key={item} className="flex items-start gap-2">
                      <CheckCircle2 className="mt-0.5 h-5 w-5 text-green-600" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="border-y bg-muted/40 py-20">
        <div className="container mx-auto px-4">
          <div className="mx-auto mb-12 max-w-3xl text-center">
            <h2 className="text-3xl font-bold md:text-4xl">Simple pricing for serious tracking work</h2>
            <p className="mt-4 text-muted-foreground">
              Start free, then scale when you need more audits, deeper validation, and agency workflows.
            </p>
          </div>

          <div className="grid gap-8 md:grid-cols-3">
            <Card className="rounded-3xl border shadow-sm">
              <CardContent className="p-8">
                <div className="text-lg font-semibold">Free</div>
                <div className="mt-2 text-sm text-muted-foreground">Best for testing the platform</div>
                <div className="mt-6">
                  <span className="text-4xl font-bold">$0</span>
                  <span className="text-muted-foreground">/month</span>
                </div>

                <ul className="mt-8 space-y-3 text-sm text-muted-foreground">
                  {[
                    "5 scans per month",
                    "Quick scan profile",
                    "Basic findings and score",
                    "Sample shareable report",
                  ].map((item) => (
                    <li key={item} className="flex items-start gap-2">
                      <CheckCircle2 className="mt-0.5 h-5 w-5 text-green-600" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>

                <Link href="/login" className="mt-8 block">
                  <Button className="w-full" variant="outline">
                    Start Free
                  </Button>
                </Link>
              </CardContent>
            </Card>

            <Card className="rounded-3xl border-primary shadow-lg">
              <CardContent className="p-8">
                <Badge className="mb-4">Most Popular</Badge>
                <div className="text-lg font-semibold">Starter</div>
                <div className="mt-2 text-sm text-muted-foreground">For growing brands and consultants</div>
                <div className="mt-6">
                  <span className="text-4xl font-bold">$49</span>
                  <span className="text-muted-foreground">/month</span>
                </div>

                <ul className="mt-8 space-y-3 text-sm text-muted-foreground">
                  {[
                    "50 scans per month",
                    "Standard scan depth",
                    "Shareable reports",
                    "Architecture graph",
                    "Basic branding",
                    "Up to 3 team members",
                  ].map((item) => (
                    <li key={item} className="flex items-start gap-2">
                      <CheckCircle2 className="mt-0.5 h-5 w-5 text-green-600" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>

                <Link href="/login" className="mt-8 block">
                  <Button className="w-full">Get Started</Button>
                </Link>
              </CardContent>
            </Card>

            <Card className="rounded-3xl border shadow-sm">
              <CardContent className="p-8">
                <div className="text-lg font-semibold">Pro</div>
                <div className="mt-2 text-sm text-muted-foreground">For agencies and advanced audit workflows</div>
                <div className="mt-6">
                  <span className="text-4xl font-bold">$149</span>
                  <span className="text-muted-foreground">/month</span>
                </div>

                <ul className="mt-8 space-y-3 text-sm text-muted-foreground">
                  {[
                    "300 scans per month",
                    "Deep scan profile",
                    "Advanced share permissions",
                    "White-label branding",
                    "Compare scans over time",
                    "Up to 10 team members",
                  ].map((item) => (
                    <li key={item} className="flex items-start gap-2">
                      <CheckCircle2 className="mt-0.5 h-5 w-5 text-green-600" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>

                <Link href="/login" className="mt-8 block">
                  <Button className="w-full" variant="outline">
                    Go Pro
                  </Button>
                </Link>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <div className="rounded-[32px] bg-primary px-6 py-16 text-center text-primary-foreground shadow-2xl md:px-12">
            <Badge variant="secondary" className="mb-4">
              Ready to audit smarter
            </Badge>
            <h2 className="text-3xl font-bold md:text-5xl">
              Stop guessing. Start auditing your tracking like a pro.
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-lg opacity-90">
              Launch your first scan, detect the gaps, and turn your tracking setup into a growth asset.
            </p>

            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link href="/login">
                <Button size="lg" variant="secondary">
                  Start Free Audit
                </Button>
              </Link>

              <Link href="/app/shared/demo">
                <Button size="lg" variant="outline" className="border-white/30 bg-transparent text-white hover:bg-white/10 hover:text-white">
                  Explore Sample Report
                  <ChevronRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t py-12">
        <div className="container mx-auto px-4">
          <div className="grid gap-8 md:grid-cols-4">
            <div>
              <div className="mb-4 flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-primary-foreground">
                  <Radar className="h-5 w-5" />
                </div>
                <span className="text-xl font-bold">PixelLens</span>
              </div>
              <p className="max-w-xs text-sm text-muted-foreground">
                Premium tracking audit platform for ecommerce brands, performance teams, and agencies.
              </p>
            </div>

            <div>
              <h3 className="mb-4 font-semibold">Product</h3>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>
                  <Link href="#features" className="hover:text-foreground">
                    Features
                  </Link>
                </li>
                <li>
                  <Link href="#pricing" className="hover:text-foreground">
                    Pricing
                  </Link>
                </li>
                <li>
                  <Link href="/app/shared/demo" className="hover:text-foreground">
                    Sample Report
                  </Link>
                </li>
              </ul>
            </div>

            <div>
              <h3 className="mb-4 font-semibold">Company</h3>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>
                  <Link href="/privacy" className="hover:text-foreground">
                    Privacy
                  </Link>
                </li>
                <li>
                  <Link href="/terms" className="hover:text-foreground">
                    Terms
                  </Link>
                </li>
              </ul>
            </div>

            <div>
              <h3 className="mb-4 font-semibold">Access</h3>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>
                  <Link href="/login" className="hover:text-foreground">
                    Login
                  </Link>
                </li>
                <li>
                  <Link href="/login" className="hover:text-foreground">
                    Start Free Audit
                  </Link>
                </li>
              </ul>
            </div>
          </div>

          <div className="mt-12 border-t pt-8 text-center text-sm text-muted-foreground">
            © 2026 PixelLens. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
}