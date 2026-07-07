import { useMemo } from 'react';
import { FilterValue } from '@/components/AdvancedFilter';

export function useAdvancedFilter<T extends Record<string, unknown>>(
  data: T[],
  filters: FilterValue[],
  searchTerm: string,
  searchFields: (keyof T)[]
) {
  return useMemo(() => {
    let filtered = [...data];

    // Apply search term
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter((item) =>
        searchFields.some((field) => {
          const value = item[field];
          if (value == null) return false;
          return String(value).toLowerCase().includes(term);
        })
      );
    }

    // Apply advanced filters
    filters.forEach((filter) => {
      if (!filter.value) return;

      filtered = filtered.filter((item) => {
        const itemValue = item[filter.field];
        const filterValue = filter.value.toLowerCase();

        if (itemValue == null) return false;

        const itemStr = String(itemValue).toLowerCase();

        switch (filter.operator) {
          case 'contains':
            return itemStr.includes(filterValue);
          
          case 'equals':
            return itemStr === filterValue;
          
          case 'not_equals':
            return itemStr !== filterValue;
          
          case 'starts_with':
            return itemStr.startsWith(filterValue);
          
          case 'ends_with':
            return itemStr.endsWith(filterValue);
          
          case 'greater':
            return Number(itemValue) > Number(filter.value);
          
          case 'less':
            return Number(itemValue) < Number(filter.value);
          
          case 'before':
            return new Date(itemValue) < new Date(filter.value);
          
          case 'after':
            return new Date(itemValue) > new Date(filter.value);
          
          default:
            return true;
        }
      });
    });

    return filtered;
  }, [data, filters, searchTerm, searchFields]);
}
