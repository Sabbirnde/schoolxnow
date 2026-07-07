import { ReactNode } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { X, Search } from "lucide-react";
import { useState } from "react";

interface Column {
  key: string;
  label: string;
  render?: (value: unknown, row: Record<string, unknown>) => ReactNode;
  width?: string;
}

interface StatsDetailModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  count: number;
  icon?: ReactNode;
  columns: Column[];
  data: Record<string, unknown>[];
  loading?: boolean;
  onRowClick?: (row: Record<string, unknown>) => void;
  searchable?: boolean;
  searchPlaceholder?: string;
}

export function StatsDetailModal({
  open,
  onOpenChange,
  title,
  description,
  count,
  icon,
  columns,
  data,
  loading = false,
  onRowClick,
  searchable = true,
  searchPlaceholder = "Search...",
}: StatsDetailModalProps) {
  const [searchTerm, setSearchTerm] = useState("");

  const filteredData = data.filter(row =>
    columns.some(col =>
      String(row[col.key] || "")
        .toLowerCase()
        .includes(searchTerm.toLowerCase())
    )
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
        <DialogHeader className="border-b pb-4">
          <div className="flex items-center gap-3">
            {icon && <div className="p-2 bg-primary/10 rounded-lg">{icon}</div>}
            <div className="flex-1">
              <DialogTitle className="text-2xl">{title}</DialogTitle>
              {description && (
                <DialogDescription className="mt-2">{description}</DialogDescription>
              )}
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onOpenChange(false)}
              className="h-8 w-8 p-0"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </DialogHeader>

        <div className="flex-1 flex flex-col overflow-hidden gap-4 p-4">
          {/* Header Stats */}
          <div className="flex items-center justify-between bg-muted/50 p-4 rounded-lg">
            <div>
              <p className="text-sm text-muted-foreground">Total Records</p>
              <p className="text-2xl font-bold text-foreground">{count}</p>
            </div>
            <div className="text-right">
              <p className="text-sm text-muted-foreground">Displayed</p>
              <p className="text-2xl font-bold text-foreground">{filteredData.length}</p>
            </div>
          </div>

          {/* Search Box */}
          {searchable && (
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={searchPlaceholder}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          )}

          {/* Data Table */}
          <ScrollArea className="flex-1">
            {loading ? (
              <div className="flex items-center justify-center h-64">
                <div className="text-muted-foreground">Loading...</div>
              </div>
            ) : filteredData.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
                <p className="text-sm">No records found</p>
                {searchTerm && <p className="text-xs">Try adjusting your search</p>}
              </div>
            ) : (
              <div className="border rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 border-b sticky top-0">
                    <tr>
                      {columns.map(col => (
                        <th
                          key={col.key}
                          className={`text-left px-4 py-3 font-semibold text-muted-foreground ${col.width || 'flex-1'}`}
                        >
                          {col.label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {filteredData.map((row, idx) => (
                      <tr
                        key={idx}
                        onClick={() => onRowClick?.(row)}
                        className={`hover:bg-muted/30 transition-colors ${onRowClick ? 'cursor-pointer' : ''}`}
                      >
                        {columns.map(col => (
                          <td key={col.key} className="px-4 py-3">
                            {col.render ? col.render(row[col.key], row) : row[col.key] || '-'}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </ScrollArea>
        </div>
      </DialogContent>
    </Dialog>
  );
}
