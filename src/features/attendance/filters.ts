import { useCallback, useState } from "react";

export function useAttendanceFilters() {
  const [selectedDate, setSelectedDate] = useState(() => new Date());
  const [selectedClass, setSelectedClass] = useState("");
  const resetFilters = useCallback(() => {
    setSelectedDate(new Date());
    setSelectedClass("");
  }, []);

  return {
    selectedDate,
    selectedClass,
    setSelectedDate,
    setSelectedClass,
    resetFilters,
  };
}
