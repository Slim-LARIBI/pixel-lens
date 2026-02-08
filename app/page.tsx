import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  CheckCircle2,
  AlertTriangle,
  TrendingUp,
  Shield,
  Zap,
  Code,
  BarChart3,
  Share2,
} from "lucide-react";

export default function LandingPage() {
  return (
    <div className="flex min-h-screen flex-col">
      {/* Header */}
      <header className="border-b">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-primary" />
            <span className="text-xl font-bold">PixelLens</span>
          </div>
          <nav className="hidden gap-6 md:flex">
            <Link href="#features" className="text-sm font-medium hover:text-primary">
              Features
            </Link>
            <Link href="#pricing" className="text-sm font-medium hover:text-primary">
              Pricing
            </Link>
            <Link href="/login" className="text-sm font-medium hover:text-primary">
              Login
            </Link>
          </nav>
          <Link href="/login">
            <Button>Start Free</Button>
          </Link>
        </div>
      </header>

      {/* Hero */}
      <section className="container mx-auto px-4 py-20 text-center">
        <Badge className="mb-4">Fix tracking that kills ROAS</Badge>
        <h1 className="mb-6 text-5xl font-bold tracking-tight md:text-6xl">
          Audit your GA4 + Meta Pixel
          <br />
          <span className="text-primary">in minutes</span>
        </h1>
        <p className="mx-auto mb-8 max-w-2xl text-xl text-muted-foreground">
          Stop losing money to broken tracking. PixelLens finds critical issues in your GA4, GTM, and Meta Pixel
          setup — so you can fix attribution and maximize ROAS.
        </p>
        <div className="flex flex-col gap-4 sm:flex-row sm:justify-center">
          <Link href="/login">
            <Button size="lg">Start Free Audit</Button>
          </Link>
          <Link href="/app/shared/demo">
            <Button size="lg" variant="outline">
              View Sample Report
            </Button>
          </Link>
        </div>
      </section>

      {/* Problem */}
      <section className="border-y bg-muted/50 py-20">
        <div className="container mx-auto px-4">
          <h2 className="mb-12 text-center text-3xl font-bold">Why tracking breaks (and kills your ROAS)</h2>
          <div className="grid gap-8 md:grid-cols-3">
            <Card>
              <CardHeader>
                <AlertTriangle className="mb-2 h-10 w-10 text-warning" />
                <CardTitle>Missing Product Data</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  Purchase events fire without item arrays. Google Ads can't optimize for products, reducing ROAS by
                  15-30%.
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <AlertTriangle className="mb-2 h-10 w-10 text-warning" />
                <CardTitle>Double-Counted Conversions</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  CAPI and Pixel fire the same event without deduplication. Your real ROAS is 1.8x, not 3.2x.
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <AlertTriangle className="mb-2 h-10 w-10 text-warning" />
                <CardTitle>Broken Dynamic Ads</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  Meta Pixel content_ids sent as string, not array. Catalog matching fails. Wrong products in ads.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <h2 className="mb-12 text-center text-3xl font-bold">How it works</h2>
          <div className="grid gap-8 md:grid-cols-4">
            {[
              { step: "1", title: "Enter Your URL", desc: "Paste your e-commerce site URL" },
              {
                step: "2",
                title: "We Scan",
                desc: "Simulate user journey from homepage to purchase",
              },
              {
                step: "3",
                title: "Get Report",
                desc: "Prioritized findings with fix code snippets",
              },
              { step: "4", title: "Fix & Improve", desc: "Implement fixes and re-scan to verify" },
            ].map((item) => (
              <div key={item.step} className="text-center">
                <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary text-xl font-bold text-primary-foreground">
                  {item.step}
                </div>
                <h3 className="mb-2 font-semibold">{item.title}</h3>
                <p className="text-sm text-muted-foreground">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="border-y bg-muted/50 py-20">
        <div className="container mx-auto px-4">
          <h2 className="mb-12 text-center text-3xl font-bold">Everything you need to fix tracking</h2>
          <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
            <Card>
              <CardHeader>
                <BarChart3 className="mb-2 h-8 w-8 text-primary" />
                <CardTitle>Multi-Platform Audit</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">GA4, GTM, Meta Pixel, Consent, and CAPI — all in one report</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <Code className="mb-2 h-8 w-8 text-primary" />
                <CardTitle>Code Snippets</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">Copy-paste fix code for every issue. No guesswork.</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <Zap className="mb-2 h-8 w-8 text-primary" />
                <CardTitle>Prioritized Plan</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  Now / Next / Later roadmap based on ROAS impact
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <Share2 className="mb-2 h-8 w-8 text-primary" />
                <CardTitle>Shareable Reports</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">Send read-only links to clients or developers</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <Shield className="mb-2 h-8 w-8 text-primary" />
                <CardTitle>Agency Branding</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">White-label reports with your logo and colors</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <TrendingUp className="mb-2 h-8 w-8 text-primary" />
                <CardTitle>Track Progress</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">Compare scans over time to verify improvements</p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="py-20">
        <div className="container mx-auto px-4">
          <h2 className="mb-12 text-center text-3xl font-bold">Simple, transparent pricing</h2>
          <div className="grid gap-8 md:grid-cols-3">
            <Card>
              <CardHeader>
                <CardTitle>Free</CardTitle>
                <CardDescription>Perfect for testing</CardDescription>
                <div className="mt-4">
                  <span className="text-4xl font-bold">$0</span>
                  <span className="text-muted-foreground">/month</span>
                </div>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="h-5 w-5 text-success" />
                    <span className="text-sm">5 scans per month</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="h-5 w-5 text-success" />
                    <span className="text-sm">Quick scan profile only</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="h-5 w-5 text-success" />
                    <span className="text-sm">Basic findings report</span>
                  </li>
                </ul>
                <Link href="/login" className="mt-6 block">
                  <Button className="w-full" variant="outline">
                    Start Free
                  </Button>
                </Link>
              </CardContent>
            </Card>

            <Card className="border-primary">
              <CardHeader>
                <Badge className="mb-2 w-fit">Most Popular</Badge>
                <CardTitle>Starter</CardTitle>
                <CardDescription>For growing teams</CardDescription>
                <div className="mt-4">
                  <span className="text-4xl font-bold">$49</span>
                  <span className="text-muted-foreground">/month</span>
                </div>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="h-5 w-5 text-success" />
                    <span className="text-sm">50 scans per month</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="h-5 w-5 text-success" />
                    <span className="text-sm">Standard scan depth</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="h-5 w-5 text-success" />
                    <span className="text-sm">Shareable reports</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="h-5 w-5 text-success" />
                    <span className="text-sm">Basic branding</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="h-5 w-5 text-success" />
                    <span className="text-sm">Up to 3 team members</span>
                  </li>
                </ul>
                <Link href="/login" className="mt-6 block">
                  <Button className="w-full">Get Started</Button>
                </Link>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Pro</CardTitle>
                <CardDescription>For agencies</CardDescription>
                <div className="mt-4">
                  <span className="text-4xl font-bold">$149</span>
                  <span className="text-muted-foreground">/month</span>
                </div>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="h-5 w-5 text-success" />
                    <span className="text-sm">300 scans per month</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="h-5 w-5 text-success" />
                    <span className="text-sm">Deep scan profile</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="h-5 w-5 text-success" />
                    <span className="text-sm">Password-protected shares</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="h-5 w-5 text-success" />
                    <span className="text-sm">Full white-label branding</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="h-5 w-5 text-success" />
                    <span className="text-sm">Compare scans</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="h-5 w-5 text-success" />
                    <span className="text-sm">Up to 10 team members</span>
                  </li>
                </ul>
                <Link href="/login" className="mt-6 block">
                  <Button className="w-full">Get Started</Button>
                </Link>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="border-y bg-primary py-20 text-primary-foreground">
        <div className="container mx-auto px-4 text-center">
          <h2 className="mb-4 text-4xl font-bold">Ready to fix your tracking?</h2>
          <p className="mb-8 text-xl opacity-90">Start with a free audit. No credit card required.</p>
          <Link href="/login">
            <Button size="lg" variant="secondary">
              Start Free Audit
            </Button>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t py-12">
        <div className="container mx-auto px-4">
          <div className="grid gap-8 md:grid-cols-4">
            <div>
              <div className="mb-4 flex items-center gap-2">
                <div className="h-8 w-8 rounded-lg bg-primary" />
                <span className="text-xl font-bold">PixelLens</span>
              </div>
              <p className="text-sm text-muted-foreground">
                Smart tracking auditor for e-commerce
              </p>
            </div>
            <div>
              <h3 className="mb-4 font-semibold">Product</h3>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>
                  <Link href="#features">Features</Link>
                </li>
                <li>
                  <Link href="#pricing">Pricing</Link>
                </li>
                <li>
                  <Link href="/app/shared/demo">Sample Report</Link>
                </li>
              </ul>
            </div>
            <div>
              <h3 className="mb-4 font-semibold">Company</h3>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>
                  <Link href="/privacy">Privacy</Link>
                </li>
                <li>
                  <Link href="/terms">Terms</Link>
                </li>
              </ul>
            </div>
            <div>
              <h3 className="mb-4 font-semibold">Connect</h3>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>
                  <Link href="/login">Login</Link>
                </li>
              </ul>
            </div>
          </div>
          <div className="mt-12 border-t pt-8 text-center text-sm text-muted-foreground">
            © 2024 PixelLens. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
}
