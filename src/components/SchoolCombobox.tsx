import { useState, useEffect } from "react";
import { Check, ChevronsUpDown, School } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { supabase } from "@/integrations/php-api/compat-client";
import { isPhpBackend } from "@/integrations/backend/provider";
import { phpApi } from "@/integrations/php-api/client";

interface SchoolComboboxProps {
  value: string;
  onValueChange: (value: string) => void;
  disabled?: boolean;
}

export function SchoolCombobox({ value, onValueChange, disabled }: SchoolComboboxProps) {
  const [open, setOpen] = useState(false);
  const [schools, setSchools] = useState<Array<{ id: string; name: string }>>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [selectedSchool, setSelectedSchool] = useState<{ id: string; name: string } | null>(null);

  // Fetch selected school details when value changes
  useEffect(() => {
    if (value && !selectedSchool) {
      const fetchSelectedSchool = async () => {
        if (isPhpBackend) {
          const data = await phpApi.table<{ id: string; name: string }>('schools').get(value);
          setSelectedSchool(data);
          return;
        }

        const { data } = await supabase
          .from('schools')
          .select('id, name')
          .eq('id', value)
          .single();
        
        if (data) {
          setSelectedSchool(data);
        }
      };
      fetchSelectedSchool();
    }
  }, [value, selectedSchool]);

  // Debounced search for schools
  useEffect(() => {
    if (!open) return;
    
    const fetchSchools = async () => {
      if (searchQuery.length < 2) {
        setSchools([]);
        return;
      }

      setLoading(true);
      try {
        if (isPhpBackend) {
          const query = searchQuery.trim().toLowerCase();
          const data = await phpApi.table<{ id: string; name: string; name_bangla?: string | null }>('schools').list({
            is_active: 1,
            sort: 'name',
            order: 'asc',
            limit: 200,
          });

          setSchools(
            data
              .filter((school) =>
                school.name.toLowerCase().includes(query) ||
                (school.name_bangla || '').toLowerCase().includes(query)
              )
              .slice(0, 50)
          );
          return;
        }

        const { data, error } = await supabase
          .from('schools')
          .select('id, name')
          .eq('is_active', true)
          .or(`name.ilike.%${searchQuery}%,name_bangla.ilike.%${searchQuery}%`)
          .order('name')
          .limit(50);
        
        if (!error && data) {
          setSchools(data);
        }
      } catch (error) {
        console.error('Error fetching schools:', error);
      } finally {
        setLoading(false);
      }
    };

    const timeoutId = setTimeout(fetchSchools, 300);
    return () => clearTimeout(timeoutId);
  }, [searchQuery, open]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between"
          disabled={disabled}
        >
          <div className="flex items-center gap-2 truncate">
            <School className="h-4 w-4 shrink-0" />
            {selectedSchool ? (
              <span className="truncate">{selectedSchool.name}</span>
            ) : (
              <span className="text-muted-foreground">Search for your institution...</span>
            )}
          </div>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[400px] p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="Type to search schools..."
            value={searchQuery}
            onValueChange={setSearchQuery}
          />
          <CommandList>
            <CommandEmpty>
              {loading ? "Searching..." : searchQuery.length < 2 ? "Type at least 2 characters to search" : "No schools found"}
            </CommandEmpty>
            <CommandGroup>
              {schools.map((school) => (
                <CommandItem
                  key={school.id}
                  value={school.id}
                  onSelect={() => {
                    onValueChange(school.id);
                    setSelectedSchool(school);
                    setOpen(false);
                  }}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      value === school.id ? "opacity-100" : "opacity-0"
                    )}
                  />
                  {school.name}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
