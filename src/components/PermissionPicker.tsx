import { ShieldCheck } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  ADMIN_PERMISSION_GROUPS,
  ADMIN_PERMISSION_LABELS,
  CLIENT_PERMISSION_GROUPS,
  CLIENT_PERMISSION_LABELS,
  type AdminPermissionGroup,
  type ClientPermissionGroup,
} from "@/lib/permissions";

type Props = {
  value: string[];
  onChange: (value: string[]) => void;
  /** admin = equipe interna; cliente = portal do médico */
  variant?: "admin" | "cliente";
};

export function PermissionPicker({ value, onChange, variant = "admin" }: Props) {
  const isWildcard = value.includes("*");
  const isClient = variant === "cliente";

  const groups = isClient ? CLIENT_PERMISSION_GROUPS : ADMIN_PERMISSION_GROUPS;
  const labels = isClient ? CLIENT_PERMISSION_LABELS : ADMIN_PERMISSION_LABELS;
  const keys = Object.keys(groups) as Array<AdminPermissionGroup | ClientPermissionGroup>;

  const toggleWildcard = (checked: boolean) => onChange(checked ? ["*"] : []);

  const toggleGroup = (key: string, checked: boolean) => {
    const perm = groups[key as keyof typeof groups] as string;
    if (checked) {
      onChange([...new Set([...value, perm])]);
    } else {
      onChange(value.filter((p) => p !== perm));
    }
  };

  return (
    <div className="space-y-3">
      <div
        className={`flex items-center gap-3 rounded-xl border p-3 transition-colors ${
          isWildcard
            ? "border-amber-200 bg-amber-50/70"
            : "border-border bg-secondary/30 hover:bg-secondary/50"
        }`}
      >
        <div className="icon-chip icon-chip-amber h-8 w-8 shrink-0">
          <ShieldCheck className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <Label htmlFor={`perm-wildcard-${variant}`} className="cursor-pointer font-semibold">
            Acesso total (*)
          </Label>
          <p className="text-[11px] text-muted-foreground">
            Libera todas as telas do {isClient ? "portal" : "painel"} — ignora as opções abaixo.
          </p>
        </div>
        <Checkbox
          id={`perm-wildcard-${variant}`}
          checked={isWildcard}
          onCheckedChange={(c) => toggleWildcard(c === true)}
        />
      </div>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {keys.map((group) => {
          const perm = groups[group as keyof typeof groups] as string;
          const label = labels[group as keyof typeof labels] as string;
          const checked = isWildcard || value.includes(perm);
          return (
            <div
              key={group}
              className={`flex items-center gap-2 rounded-xl border p-2.5 transition-colors ${
                isWildcard
                  ? "border-border/60 bg-muted/30"
                  : checked
                    ? "border-primary/25 bg-primary/5"
                    : "border-border bg-card hover:bg-secondary/30"
              }`}
            >
              <Checkbox
                id={`perm-${variant}-${group}`}
                disabled={isWildcard}
                checked={checked}
                onCheckedChange={(c) => toggleGroup(group, c === true)}
              />
              <Label
                htmlFor={`perm-${variant}-${group}`}
                className={`cursor-pointer text-sm ${isWildcard ? "text-muted-foreground" : ""}`}
              >
                {label}
              </Label>
            </div>
          );
        })}
      </div>
    </div>
  );
}
