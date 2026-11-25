import { useState, type FormEvent } from 'react';
import { Plus } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/src/components/ui/card';
import { Button } from '@/src/components/ui/button';
import { Input } from '@/src/components/ui/input';
import { Label } from '@/src/components/ui/label';
import { useRestoStore } from '@/src/lib/store/RestoConnectStore';

interface CustomersModuleViewProps {
  restaurantId?: string;
}

export function CustomersModuleView({ restaurantId }: CustomersModuleViewProps) {
  const { activeTenantId, customers, createCustomer } = useRestoStore();
  const tenantId = restaurantId ?? activeTenantId;
  const tenantCustomers = customers.filter((c) => c.restaurant_id === tenantId);

  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [notes, setNotes] = useState('');
  const [search, setSearch] = useState('');

  const filtered = tenantCustomers.filter(
    (c) =>
      c.full_name.toLowerCase().includes(search.toLowerCase()) ||
      (c.phone ?? '').includes(search)
  );

  function handleAddCustomer(e: FormEvent) {
    e.preventDefault();
    const res = createCustomer({
      restaurantId: tenantId,
      fullName,
      phone,
      email,
      notes,
    });
    if (res.ok) {
      setFullName('');
      setPhone('');
      setEmail('');
      setNotes('');
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Ajouter un client</CardTitle>
          <CardDescription>Répertoire fidélité strictement isolé par restaurant.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleAddCustomer} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 items-end">
            <div className="space-y-1.5">
              <Label htmlFor="cust-name">Nom complet</Label>
              <Input
                id="cust-name"
                placeholder="Nom complet"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cust-phone">Téléphone</Label>
              <Input
                id="cust-phone"
                placeholder="+243 ..."
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cust-email">E-mail</Label>
              <Input
                id="cust-email"
                type="email"
                placeholder="client@exemple.cd"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cust-notes">Préférences</Label>
              <Input
                id="cust-notes"
                placeholder="Allergies, table préférée..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>
            <div className="sm:col-span-2 lg:col-span-4 flex justify-end">
              <Button type="submit" size="sm">
                <Plus className="h-4 w-4" aria-hidden="true" />
                <span>Enregistrer le client</span>
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <CardTitle>Clients ({filtered.length})</CardTitle>
          <Input
            aria-label="Rechercher un client"
            placeholder="Rechercher par nom ou téléphone..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="sm:w-64"
          />
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto rounded-md border border-[var(--rc-border)]">
            <table className="w-full border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-[var(--rc-border)] bg-[var(--rc-surface-muted)] text-xs font-semibold text-[var(--rc-muted)]">
                  <th className="px-4 py-3">Nom</th>
                  <th className="px-4 py-3">Téléphone</th>
                  <th className="px-4 py-3">E-mail</th>
                  <th className="px-4 py-3">Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--rc-border)]">
                {filtered.map((c) => (
                  <tr key={c.id} className="hover:bg-[var(--rc-card-elevated)]">
                    <td className="px-4 py-3 font-medium whitespace-nowrap">{c.full_name}</td>
                    <td className="px-4 py-3 font-mono text-xs text-[var(--rc-muted)] whitespace-nowrap">
                      {c.phone ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-xs text-[var(--rc-muted)] whitespace-nowrap">
                      {c.email ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-xs text-[var(--rc-muted)]">{c.notes ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
