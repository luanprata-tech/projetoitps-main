import { useState } from "react";

const amountFormat = new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function MoneyCell({ value, onChange, label }: { value: number; onChange?: (value: number) => void; label?: string }) {
  const [editing, setEditing] = useState(false);
  return (
    <div className="money-cell grid grid-cols-[auto_minmax(0,1fr)] items-center gap-2 tabular-nums">
      <span>R$</span>
      {onChange ? <input
        aria-label={label ?? "Valor em reais"}
        type={editing ? "number" : "text"}
        inputMode="decimal"
        step="0.01"
        value={editing ? String(value) : amountFormat.format(value)}
        onFocus={() => setEditing(true)}
        onBlur={() => setEditing(false)}
        onChange={(e) => onChange(Number(e.target.value))}
        className="min-w-0 w-full rounded border border-transparent bg-transparent py-1 text-sm outline-none hover:border-input focus:border-ring focus:bg-card"
      /> : <span className="text-right">{amountFormat.format(value)}</span>}
    </div>
  );
}