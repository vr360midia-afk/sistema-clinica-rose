import * as React from "react";
import { format, isValid } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarIcon, X } from "lucide-react";

import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

export interface DatePickerInputProps {
  id?: string;
  name?: string;
  value?: Date | string | null;
  onChange: (date: Date | null) => void;
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
  className?: string;
  containerClassName?: string;
  fromYear?: number;
  toYear?: number;
}

export function DatePickerInput({
  id,
  name,
  value,
  onChange,
  placeholder = "DD/MM/AAAA",
  disabled = false,
  required = false,
  className,
  containerClassName,
  fromYear,
  toYear,
}: DatePickerInputProps) {
  const [isOpen, setIsOpen] = React.useState(false);

  // Formata o valor recebido para exibição no campo
  const toDisplayString = React.useCallback((val: Date | string | null | undefined): string => {
    if (!val) return "";
    const d = val instanceof Date ? val : new Date(val);
    if (!isValid(d)) return "";
    return format(d, "dd/MM/yyyy");
  }, []);

  const [textValue, setTextValue] = React.useState<string>(() => toDisplayString(value));

  // Sincroniza o texto do campo quando o valor externo muda
  React.useEffect(() => {
    setTextValue(toDisplayString(value));
  }, [value, toDisplayString]);

  // Aplica máscara automática DD/MM/AAAA conforme digitação
  const formatDigits = (digits: string): string => {
    if (digits.length <= 2) return digits;
    if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
    return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4, 8)}`;
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawVal = e.target.value;
    const digits = rawVal.replace(/\D/g, "").slice(0, 8);
    const masked = formatDigits(digits);
    setTextValue(masked);

    // Se o usuário apagou tudo
    if (digits.length === 0) {
      if (!required) {
        onChange(null);
      }
      return;
    }

    // Quando completou 8 dígitos (DDMMAAAA), valida a data e dispara onChange
    if (digits.length === 8) {
      const day = parseInt(digits.slice(0, 2), 10);
      const month = parseInt(digits.slice(2, 4), 10);
      const year = parseInt(digits.slice(4, 8), 10);

      if (day >= 1 && day <= 31 && month >= 1 && month <= 12 && year >= 1900 && year <= 2100) {
        // Horário ao meio-dia para evitar deslocamento de fuso horário / DST
        const parsed = new Date(year, month - 1, day, 12, 0, 0);
        if (
          parsed.getFullYear() === year &&
          parsed.getMonth() === month - 1 &&
          parsed.getDate() === day
        ) {
          onChange(parsed);
        }
      }
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    const pasted = e.clipboardData.getData("text").trim();
    // Suporte caso colem formato ISO YYYY-MM-DD
    const isoMatch = pasted.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (isoMatch) {
      e.preventDefault();
      const [, y, m, d] = isoMatch;
      const formatted = `${d}/${m}/${y}`;
      setTextValue(formatted);
      const parsed = new Date(Number(y), Number(m) - 1, Number(d), 12, 0, 0);
      if (isValid(parsed)) {
        onChange(parsed);
      }
      return;
    }
  };

  const handleBlur = () => {
    const digits = textValue.replace(/\D/g, "");
    // Se a digitação ficou incompleta (ex: digitou só 18/10 e saiu)
    if (digits.length > 0 && digits.length < 8) {
      setTextValue(toDisplayString(value));
      return;
    }
    // Se digitou 8 dígitos, garante que a data é válida, senão reverte
    if (digits.length === 8) {
      const day = parseInt(digits.slice(0, 2), 10);
      const month = parseInt(digits.slice(2, 4), 10);
      const year = parseInt(digits.slice(4, 8), 10);
      const parsed = new Date(year, month - 1, day, 12, 0, 0);
      const isDateValid =
        day >= 1 &&
        day <= 31 &&
        month >= 1 &&
        month <= 12 &&
        year >= 1900 &&
        year <= 2100 &&
        parsed.getFullYear() === year &&
        parsed.getMonth() === month - 1 &&
        parsed.getDate() === day;

      if (!isDateValid) {
        setTextValue(toDisplayString(value));
      }
    }
  };

  const handleCalendarSelect = (date: Date | undefined) => {
    if (date) {
      const adjusted = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 12, 0, 0);
      onChange(adjusted);
      setTextValue(format(adjusted, "dd/MM/yyyy"));
    } else if (!required) {
      onChange(null);
      setTextValue("");
    }
    setIsOpen(false);
  };

  const currentDateObj = React.useMemo(() => {
    if (!value) return undefined;
    const d = value instanceof Date ? value : new Date(value);
    return isValid(d) ? d : undefined;
  }, [value]);

  const currentYear = new Date().getFullYear();

  return (
    <div className={cn("relative flex items-center w-full", containerClassName)}>
      <Input
        id={id}
        name={name}
        type="text"
        inputMode="numeric"
        placeholder={placeholder}
        value={textValue}
        onChange={handleInputChange}
        onPaste={handlePaste}
        onBlur={handleBlur}
        disabled={disabled}
        maxLength={10}
        className={cn(
          "pl-3 pr-16 h-10 w-full font-medium tracking-wide bg-background text-sm",
          className
        )}
      />

      <div className="absolute right-1 top-1/2 -translate-y-1/2 flex items-center gap-0.5">
        {textValue && !required && !disabled && (
          <button
            type="button"
            onClick={() => {
              setTextValue("");
              onChange(null);
            }}
            className="h-7 w-7 inline-flex items-center justify-center text-muted-foreground hover:text-foreground rounded-md hover:bg-accent/50 transition-colors"
            title="Limpar data"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}

        <Popover open={isOpen} onOpenChange={setIsOpen}>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              disabled={disabled}
              className="h-8 w-8 text-muted-foreground hover:text-foreground hover:bg-accent/60 rounded-md transition-colors"
              title="Abrir calendário"
            >
              <CalendarIcon className="h-4 w-4" />
            </Button>
          </PopoverTrigger>
          <PopoverContent
            className="w-auto p-0 z-[70] shadow-2xl border border-border bg-popover max-h-[85vh] overflow-y-auto"
            align="start"
            side="bottom"
            avoidCollisions={true}
            collisionPadding={12}
          >
            <Calendar
              mode="single"
              selected={currentDateObj}
              defaultMonth={currentDateObj || new Date()}
              onSelect={handleCalendarSelect}
              locale={ptBR}
              captionLayout="dropdown-buttons"
              fromYear={fromYear ?? currentYear - 10}
              toYear={toYear ?? currentYear + 10}
              className="p-3 pointer-events-auto"
            />
          </PopoverContent>
        </Popover>
      </div>
    </div>
  );
}
