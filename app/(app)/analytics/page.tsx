import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { prisma } from "@/lib/db";
import { computeGtmAnalytics } from "@/lib/analytics/gtmAnalytics";
import { AnalyticsTable } from "@/components/analytics/analytics-table";

export const dynamic = "force-dynamic";

export default async function AnalyticsPage() {
  const analytics = await computeGtmAnalytics(prisma);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">GTM Analytics</h1>
        <p className="text-sm text-muted-foreground">
          Descriptive counts and rates computed directly from activations and recorded outcomes — grouped for
          comparison, never ranked as &quot;best&quot; or &quot;worst&quot;.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">By activation channel</CardTitle>
        </CardHeader>
        <CardContent>
          <AnalyticsTable keyLabel="Channel" buckets={analytics.byChannel} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">By activation angle</CardTitle>
        </CardHeader>
        <CardContent>
          <AnalyticsTable keyLabel="Angle" buckets={analytics.byAngle} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">By signal type</CardTitle>
        </CardHeader>
        <CardContent>
          <AnalyticsTable keyLabel="Signal type" buckets={analytics.bySignalType} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">By persona</CardTitle>
        </CardHeader>
        <CardContent>
          <AnalyticsTable keyLabel="Persona" buckets={analytics.byPersona} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">By product</CardTitle>
        </CardHeader>
        <CardContent>
          <AnalyticsTable keyLabel="Product" buckets={analytics.byProduct} />
        </CardContent>
      </Card>
    </div>
  );
}
