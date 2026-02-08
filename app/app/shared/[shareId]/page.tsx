import { db } from "@/lib/db";
import { notFound } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { AlertTriangle, CheckCircle2, Info } from "lucide-react";
import { formatDateTime } from "@/lib/utils";
import Link from "next/link";
import ReactMarkdown from "react-markdown";

export default async function SharedScanPage({ params }: { params: Promise<{ shareId: string }> }) {
  const { shareId } = await params;

  const shareLink = await db.shareLink.findUnique({
    where: { slug: shareId },
    include: {
      scan: {
        include: {
          workspace: true,
        },
      },
    },
  });

  if (!shareLink || shareLink.revokedAt) {
    notFound();
  }

  const scan = shareLink.scan;

  // Parse JSON fields
  const categoryScores = scan.categoryScores ? JSON.parse(scan.categoryScores) : null;
  const findings = scan.findings ? JSON.parse(scan.findings) : [];
  const eventsTimeline = scan.eventsTimeline ? JSON.parse(scan.eventsTimeline) : [];

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case "CRITICAL":
        return "danger";
      case "HIGH":
        return "warning";
      default:
        return "secondary";
    }
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case "CRITICAL":
      case "HIGH":
        return <AlertTriangle className="h-4 w-4" />;
      case "INFO":
        return <CheckCircle2 className="h-4 w-4" />;
      default:
        return <Info className="h-4 w-4" />;
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <Link href="/" className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-primary" />
            <span className="text-xl font-bold">PixelLens</span>
          </Link>
          <Link href="/login">
            <Badge variant="outline">Get Your Own Report</Badge>
          </Link>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8">
        <div className="space-y-8">
          {/* Header */}
          <div>
            <div className="mb-2">
              <Badge variant="secondary">{formatDateTime(scan.createdAt)}</Badge>
            </div>
            <h1 className="text-3xl font-bold">{scan.url}</h1>
            <p className="text-muted-foreground">Scan profile: {scan.profile}</p>
            {shareLink.workspace.brandColor && (
              <p className="mt-2 text-sm text-muted-foreground">
                Report by {shareLink.workspace.name}
              </p>
            )}
          </div>

          {/* Overall Score */}
          <div className="grid gap-4 md:grid-cols-6">
            <Card className="md:col-span-2">
              <CardHeader>
                <CardTitle>Overall Score</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-center">
                  <div className="mb-4 text-6xl font-bold">{scan.overallScore}</div>
                  <Progress value={scan.overallScore || 0} className="h-2" />
                  <p className="mt-2 text-sm text-muted-foreground">
                    {(scan.overallScore || 0) >= 75
                      ? "Good foundation"
                      : (scan.overallScore || 0) >= 50
                      ? "Needs work"
                      : "Critical issues"}
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Category Scores */}
            {categoryScores && (
              <>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">GA4</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{categoryScores.ga4.score}</div>
                    <Badge variant="secondary" className="mt-1 text-xs">
                      {categoryScores.ga4.status}
                    </Badge>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">GTM</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{categoryScores.gtm.score}</div>
                    <Badge variant="secondary" className="mt-1 text-xs">
                      {categoryScores.gtm.status}
                    </Badge>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Meta</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{categoryScores.meta.score}</div>
                    <Badge variant="secondary" className="mt-1 text-xs">
                      {categoryScores.meta.status}
                    </Badge>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">CAPI</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{categoryScores.capi.score}</div>
                    <Badge variant="secondary" className="mt-1 text-xs">
                      {categoryScores.capi.status}
                    </Badge>
                  </CardContent>
                </Card>
              </>
            )}
          </div>

          {/* Tabs */}
          <Tabs defaultValue="summary" className="space-y-4">
            <TabsList>
              <TabsTrigger value="summary">Summary</TabsTrigger>
              <TabsTrigger value="findings">Findings ({findings.length})</TabsTrigger>
            </TabsList>

            <TabsContent value="summary" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Executive Summary</CardTitle>
                </CardHeader>
                <CardContent className="prose prose-sm max-w-none dark:prose-invert">
                  <ReactMarkdown>{scan.executiveSummary || "No summary available"}</ReactMarkdown>
                </CardContent>
              </Card>

              {/* CTA */}
              <Card className="border-primary bg-primary/5">
                <CardContent className="py-8 text-center">
                  <h3 className="mb-2 text-lg font-semibold">Want to audit your own site?</h3>
                  <p className="mb-4 text-sm text-muted-foreground">
                    Get detailed tracking reports for your e-commerce website
                  </p>
                  <Link href="/login">
                    <Badge className="cursor-pointer text-base">Start Free Audit</Badge>
                  </Link>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="findings" className="space-y-4">
              {findings.map((finding: any) => (
                <Card key={finding.id}>
                  <CardHeader>
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="mb-2 flex items-center gap-2">
                          <Badge variant={getSeverityColor(finding.severity) as any}>
                            {getSeverityIcon(finding.severity)}
                            {finding.severity}
                          </Badge>
                          <Badge variant="outline">{finding.category}</Badge>
                        </div>
                        <CardTitle className="text-lg">{finding.title}</CardTitle>
                        <CardDescription>{finding.description}</CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {finding.howToFix && (
                      <div>
                        <h4 className="mb-1 text-sm font-semibold">How to Fix</h4>
                        <p className="text-sm text-muted-foreground">{finding.howToFix}</p>
                      </div>
                    )}

                    {finding.codeSnippet && (
                      <div>
                        <h4 className="mb-1 text-sm font-semibold">Code Snippet</h4>
                        <pre className="overflow-x-auto rounded-lg bg-muted p-4 text-xs">
                          <code>{finding.codeSnippet}</code>
                        </pre>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </TabsContent>
          </Tabs>

          {/* Footer CTA */}
          <Card className="bg-muted">
            <CardContent className="py-8 text-center">
              <div className="mx-auto mb-4 h-12 w-12 rounded-lg bg-primary" />
              <h3 className="mb-2 text-xl font-bold">Powered by PixelLens</h3>
              <p className="mb-4 text-sm text-muted-foreground">
                Smart tracking & pixel auditor for e-commerce
              </p>
              <Link href="/">
                <Badge variant="outline" className="cursor-pointer">
                  Learn More
                </Badge>
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
