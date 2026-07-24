import { memo } from "react";
import { Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { AttendanceSummary } from "../types";

export const AttendanceSummaryCard = memo(function AttendanceSummaryCard({
  summary,
}: {
  summary: AttendanceSummary;
}) {
  return (
    <Card>
      <CardHeader className="p-4 md:p-6">
        <CardTitle className="flex items-center gap-2 text-base md:text-lg">
          <Users className="h-5 w-5" />
          Attendance Summary
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 p-4 md:p-6">
        <div className="text-center">
          <div className="text-3xl md:text-4xl font-bold text-primary">
            {summary.percentage}%
          </div>
          <div className="text-xs md:text-sm text-muted-foreground">
            Attendance Rate
          </div>
        </div>
        {[
          [
            "Marked",
            `${summary.marked} / ${summary.total}`,
            "bg-blue-50 text-blue-700 border-blue-200",
          ],
          [
            "Present",
            summary.present,
            "bg-green-50 text-green-700 border-green-200",
          ],
          ["Absent", summary.absent, "bg-red-50 text-red-700 border-red-200"],
        ].map(([label, value, className]) => (
          <div
            key={label}
            className="flex items-center justify-between rounded-lg bg-muted/50 p-2"
          >
            <span className="text-sm font-medium">{label}</span>
            <Badge variant="outline" className={String(className)}>
              {value}
            </Badge>
          </div>
        ))}
      </CardContent>
    </Card>
  );
});
