import type { ReactNode } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/src/components/ui/card';

export interface SchemaColumn {
  key: string;
  label: string;
  align?: 'left' | 'right';
}

interface SchemaTableShellProps {
  title: string;
  description: string;
  tableName: string;
  columns: SchemaColumn[];
  emptyMessage: string;
  headerAction?: ReactNode;
}

export function SchemaTableShell({
  title,
  description,
  tableName,
  columns,
  emptyMessage,
  headerAction,
}: SchemaTableShellProps) {
  return (
    <Card>
      <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="space-y-1">
          <CardTitle>{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </div>
        {headerAction && <div className="shrink-0">{headerAction}</div>}
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto rounded-lg border border-[var(--rc-border)]">
          <table className="w-full border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-[var(--rc-border)] bg-[var(--rc-bg-subtle)] text-xs font-semibold text-[var(--rc-muted)]">
                {columns.map((col) => (
                  <th
                    key={col.key}
                    className={`px-4 py-3 whitespace-nowrap ${
                      col.align === 'right' ? 'text-right' : 'text-left'
                    }`}
                  >
                    {col.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr>
                <td colSpan={columns.length} className="px-4 py-10 text-center">
                  <p className="text-sm font-medium text-[var(--rc-fg)]">{emptyMessage}</p>
                  <p className="mt-1 text-xs text-[var(--rc-muted)]">
                    Source PostgreSQL :{' '}
                    <code className="font-mono text-[var(--rc-gold-text)]">public.{tableName}</code> · Isolation RLS par{' '}
                    <code className="font-mono text-[var(--rc-gold-text)]">restaurant_id</code>
                  </p>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
