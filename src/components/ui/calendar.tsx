
import * as React from "react";
import { ChevronLeft, ChevronRight, ChevronDown } from "lucide-react";
import { DayPicker } from "react-day-picker";

import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";

export type CalendarProps = React.ComponentProps<typeof DayPicker>;

function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  components,
  ...props
}: CalendarProps) {
  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      className={cn("p-2 sm:p-3 w-full", className)}
      classNames={{
        months: "flex flex-col space-y-3 w-full",
        month: "space-y-3 w-full",
        caption: "flex justify-center pt-1 relative items-center mb-3 min-h-[32px]",
        caption_label: cn(
          "text-sm font-semibold tracking-wide capitalize",
          props.captionLayout?.includes("dropdown") && "hidden"
        ),
        caption_dropdowns: "flex justify-center items-center gap-1.5",
        dropdown_month: "relative inline-flex items-center",
        dropdown_year: "relative inline-flex items-center",
        dropdown: "appearance-none bg-card text-card-foreground border border-input rounded-md px-2 py-1 text-xs font-semibold cursor-pointer hover:bg-accent hover:text-accent-foreground focus:outline-none focus:ring-1 focus:ring-ring capitalize [&_option]:bg-card [&_option]:text-card-foreground",
        vhidden: "sr-only",
        nav: "space-x-1 flex items-center",
        nav_button: cn(
          buttonVariants({ variant: "outline" }),
          "h-7 w-7 bg-transparent p-0 opacity-70 hover:opacity-100 hover:bg-accent"
        ),
        nav_button_previous: "absolute left-1",
        nav_button_next: "absolute right-1",
        table: "w-full border-collapse",
        head_row: "flex w-full",
        head_cell:
          "text-muted-foreground rounded-md flex-1 font-normal text-[0.8rem] text-center flex items-center justify-center h-8 sm:h-9",
        row: "flex w-full mt-1.5",
        cell: "flex-1 h-8 sm:h-9 text-center text-sm p-0 relative [&:has([aria-selected].day-range-end)]:rounded-r-md [&:has([aria-selected].day-outside)]:bg-accent/50 [&:has([aria-selected])]:bg-accent first:[&:has([aria-selected])]:rounded-l-md last:[&:has([aria-selected])]:rounded-r-md focus-within:relative focus-within:z-20",
        day: cn(
          buttonVariants({ variant: "ghost" }),
          "h-8 w-8 sm:h-9 sm:w-9 p-0 font-normal aria-selected:opacity-100 flex items-center justify-center hover:bg-accent hover:text-accent-foreground transition-colors"
        ),
        day_range_end: "day-range-end",
        day_selected:
          "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground focus:bg-primary focus:text-primary-foreground",
        day_today: "bg-accent text-accent-foreground font-semibold",
        day_outside:
          "day-outside text-muted-foreground opacity-50 aria-selected:bg-accent/50 aria-selected:text-muted-foreground aria-selected:opacity-30",
        day_disabled: "text-muted-foreground opacity-50",
        day_range_middle:
          "aria-selected:bg-accent aria-selected:text-accent-foreground",
        day_hidden: "invisible",
        ...classNames,
      }}
      components={{
        IconLeft: ({ ..._props }) => <ChevronLeft className="h-4 w-4" />,
        IconRight: ({ ..._props }) => <ChevronRight className="h-4 w-4" />,
        Dropdown: ({ value, onChange, children, className: dropClassName, ...dropProps }) => (
          <div className="relative inline-flex items-center">
            <select
              value={value}
              onChange={onChange}
              className={cn(
                "h-7 pr-5 pl-2 text-xs font-semibold rounded-md border border-input bg-card text-card-foreground shadow-sm hover:bg-accent hover:text-accent-foreground focus:outline-none focus:ring-1 focus:ring-ring cursor-pointer capitalize appearance-none transition-colors [&_option]:bg-card [&_option]:text-card-foreground",
                dropClassName
              )}
              {...dropProps}
            >
              {children}
            </select>
            <ChevronDown className="absolute right-1 h-3 w-3 pointer-events-none opacity-60 text-muted-foreground" />
          </div>
        ),
        ...components,
      }}
      {...props}
    />
  );
}
Calendar.displayName = "Calendar";

export { Calendar };
