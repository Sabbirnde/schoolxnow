import { ReactNode } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

interface Column<T> {
  header: string;
  accessor: keyof T | ((item: T) => ReactNode);
  className?: string;
  mobileLabel?: string;
}

interface ResponsiveTableProps<T> {
  data: T[];
  columns: Column<T>[];
  title?: string;
  emptyMessage?: string;
  onRowClick?: (item: T) => void;
  className?: string;
}

export function ResponsiveTable<T extends { id: string }>({
  data,
  columns,
  title,
  emptyMessage = "No data available",
  onRowClick,
  className,
}: ResponsiveTableProps<T>) {
  const getCellValue = (item: T, column: Column<T>) => {
    if (typeof column.accessor === 'function') {
      return column.accessor(item);
    }
    return item[column.accessor] as ReactNode;
  };

  return (
    <Card className={cn("shadow-sm", className)}>
      {title && (
        <CardHeader className="p-3 md:p-6">
          <CardTitle className="text-lg md:text-xl">{title}</CardTitle>
        </CardHeader>
      )}
      <CardContent className="p-0">
        {/* Desktop Table View */}
        <div className="hidden md:block">
          <ScrollArea className="h-[600px]">
            <table className="w-full">
              <thead className="bg-muted/50 sticky top-0 z-10">
                <tr>
                  {columns.map((column, idx) => (
                    <th
                      key={idx}
                      className={cn(
                        "px-4 py-3 text-left text-sm font-medium text-muted-foreground",
                        column.className
                      )}
                    >
                      {column.header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.length > 0 ? (
                  data.map((item) => (
                    <tr
                      key={item.id}
                      onClick={() => onRowClick?.(item)}
                      className={cn(
                        "border-b border-border transition-colors",
                        onRowClick && "cursor-pointer hover:bg-muted/50"
                      )}
                    >
                      {columns.map((column, idx) => (
                        <td key={idx} className={cn("px-4 py-3 text-sm", column.className)}>
                          {getCellValue(item, column)}
                        </td>
                      ))}
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td
                      colSpan={columns.length}
                      className="px-4 py-8 text-center text-muted-foreground"
                    >
                      {emptyMessage}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </ScrollArea>
        </div>

        {/* Mobile Card View */}
        <div className="md:hidden">
          <ScrollArea className="h-[600px]">
            <div className="space-y-3 p-3">
              {data.length > 0 ? (
                data.map((item) => (
                  <div
                    key={item.id}
                    onClick={() => onRowClick?.(item)}
                    className={cn(
                      "p-4 border border-border rounded-lg space-y-2 transition-colors",
                      onRowClick && "active:bg-muted/50"
                    )}
                  >
                    {columns.map((column, idx) => (
                      <div key={idx} className="flex justify-between items-start gap-2">
                        <span className="text-xs text-muted-foreground font-medium min-w-[100px]">
                          {column.mobileLabel || column.header}:
                        </span>
                        <span className="text-sm text-right flex-1">
                          {getCellValue(item, column)}
                        </span>
                      </div>
                    ))}
                  </div>
                ))
              ) : (
                <div className="py-8 text-center text-muted-foreground">
                  {emptyMessage}
                </div>
              )}
            </div>
          </ScrollArea>
        </div>
      </CardContent>
    </Card>
  );
}
