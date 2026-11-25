import { useState, type FormEvent } from 'react';
import { Plus, Pencil, AlertCircle, CheckCircle2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/src/components/ui/card';
import { Button } from '@/src/components/ui/button';
import { Input } from '@/src/components/ui/input';
import { Label } from '@/src/components/ui/label';
import { StatusLabel } from '@/src/components/layout/StatusLabel';
import { useRestoStore } from '@/src/lib/store/RestoConnectStore';
import type { ReservationRecord, RestaurantTableRecord } from '@/src/lib/supabase/database.types';

const TABLE_STATUS_META: Record<
  RestaurantTableRecord['status'],
  { label: string; tone: 'emerald' | 'amber' | 'crimson' | 'neutral' }
> = {
  available: { label: 'Libre', tone: 'emerald' },
  occupied: { label: 'Occupée', tone: 'amber' },
  reserved: { label: 'Réservée', tone: 'neutral' },
  inactive: { label: 'Fermée', tone: 'crimson' },
};

const RES_STATUS_META: Record<
  ReservationRecord['status'],
  { label: string; tone: 'emerald' | 'amber' | 'crimson' | 'neutral' }
> = {
  pending: { label: 'En attente', tone: 'amber' },
  confirmed: { label: 'Confirmée', tone: 'emerald' },
  rejected: { label: 'Refusée', tone: 'crimson' },
  seated: { label: 'Installée', tone: 'emerald' },
  completed: { label: 'Terminée', tone: 'neutral' },
  cancelled: { label: 'Annulée', tone: 'crimson' },
  no_show: { label: 'Absent', tone: 'crimson' },
};

interface ReservationsModuleViewProps {
  restaurantId?: string;
}

export function ReservationsModuleView({ restaurantId }: ReservationsModuleViewProps) {
  const {
    activeTenantId,
    tables,
    reservations,
    createTable,
    updateTableStatus,
    createReservation,
    updateReservationStatus,
    updateReservationDetails,
  } = useRestoStore();

  const tenantId = restaurantId ?? activeTenantId;
  const tenantTables = tables.filter((t) => t.restaurant_id === tenantId);
  const tenantReservations = reservations.filter((r) => r.restaurant_id === tenantId);

  const [tableNumber, setTableNumber] = useState('');
  const [zone, setZone] = useState('Salle principale');
  const [capacity, setCapacity] = useState('4');

  const [guestName, setGuestName] = useState('');
  const [guestPhone, setGuestPhone] = useState('');
  const [partySize, setPartySize] = useState('2');
  const [reservedFor, setReservedFor] = useState('2026-11-26T20:00');
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const [statusFilter, setStatusFilter] = useState<'all' | ReservationRecord['status']>('all');
  const [dateFilter, setDateFilter] = useState('');

  // Édition de réservation (affectation table + horaire avec contrôle conflit)
  const [editingResId, setEditingResId] = useState<string | null>(null);
  const [editTableId, setEditTableId] = useState('');
  const [editSize, setEditSize] = useState('2');
  const [editDate, setEditDate] = useState('');

  const filteredReservations = tenantReservations.filter((r) => {
    if (statusFilter !== 'all' && r.status !== statusFilter) return false;
    if (dateFilter && !r.reserved_for.startsWith(dateFilter)) return false;
    return true;
  });

  function handleAddTable(e: FormEvent) {
    e.preventDefault();
    const res = createTable({
      restaurantId: tenantId,
      tableNumber,
      zone,
      capacity: Number(capacity) || 4,
    });
    if (!res.ok) {
      setFeedback({ type: 'error', text: res.error });
      return;
    }
    setTableNumber('');
    setFeedback({ type: 'success', text: 'Table ajoutée au plan de salle.' });
  }

  function handleAddReservation(e: FormEvent) {
    e.preventDefault();
    const res = createReservation({
      restaurantId: tenantId,
      guestName,
      guestPhone,
      partySize: Number(partySize) || 2,
      reservedFor,
    });
    if (!res.ok) {
      setFeedback({ type: 'error', text: res.error });
      return;
    }
    setGuestName('');
    setGuestPhone('');
    setFeedback({ type: 'success', text: 'Réservation enregistrée.' });
  }

  function handleSaveEdit(e: FormEvent) {
    e.preventDefault();
    if (!editingResId) return;
    const res = updateReservationDetails(editingResId, {
      tableId: editTableId || null,
      partySize: Number(editSize) || 2,
      reservedFor: editDate,
    });
    if (!res.ok) {
      setFeedback({ type: 'error', text: res.error });
      return;
    }
    setEditingResId(null);
    setFeedback({ type: 'success', text: 'Réservation mise à jour sans conflit.' });
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <Card className="lg:col-span-5">
          <CardHeader>
            <CardTitle>Ajouter une table</CardTitle>
            <CardDescription>Salle principale, Terrasse ou Salon privé.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleAddTable} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="tbl-num">N° Table</Label>
                  <Input
                    id="tbl-num"
                    placeholder="T-08"
                    value={tableNumber}
                    onChange={(e) => setTableNumber(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="tbl-cap">Couverts</Label>
                  <Input
                    id="tbl-cap"
                    type="number"
                    min={1}
                    value={capacity}
                    onChange={(e) => setCapacity(e.target.value)}
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="tbl-zone">Zone</Label>
                <Input
                  id="tbl-zone"
                  value={zone}
                  onChange={(e) => setZone(e.target.value)}
                />
              </div>
              <Button type="submit" size="sm" className="w-full">
                <Plus className="h-4 w-4" aria-hidden="true" />
                <span>Créer la table</span>
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card className="lg:col-span-7">
          <CardHeader>
            <CardTitle>Enregistrer une réservation</CardTitle>
            <CardDescription>Contrôle automatique des chevauchements et capacités.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleAddReservation} className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="adm-res-name">Client</Label>
                <Input
                  id="adm-res-name"
                  placeholder="Nom complet"
                  value={guestName}
                  onChange={(e) => setGuestName(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="adm-res-phone">Téléphone</Label>
                <Input
                  id="adm-res-phone"
                  placeholder="+243 ..."
                  value={guestPhone}
                  onChange={(e) => setGuestPhone(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="adm-res-size">Personnes</Label>
                <Input
                  id="adm-res-size"
                  type="number"
                  min={1}
                  value={partySize}
                  onChange={(e) => setPartySize(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="adm-res-date">Date &amp; Heure</Label>
                <Input
                  id="adm-res-date"
                  type="datetime-local"
                  value={reservedFor}
                  onChange={(e) => setReservedFor(e.target.value)}
                  required
                />
              </div>
              <div className="sm:col-span-2 flex justify-end pt-1">
                <Button type="submit" size="sm">Ajouter la réservation</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>

      {feedback && (
        <div
          role="status"
          className={`flex items-start gap-2 rounded-md border p-3 text-xs ${
            feedback.type === 'error'
              ? 'border-[var(--rc-danger-border)] bg-[var(--rc-danger-bg)] text-[var(--rc-danger-fg)]'
              : 'border-[var(--rc-success-border)] bg-[var(--rc-success-bg)] text-[var(--rc-success-fg)]'
          }`}
        >
          {feedback.type === 'error' ? (
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
          ) : (
            <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" />
          )}
          <span>{feedback.text}</span>
        </div>
      )}

      {editingResId && (
        <Card className="border-[var(--rc-gold)]">
          <CardHeader>
            <CardTitle className="text-base">Modifier &amp; Affecter une table</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSaveEdit} className="grid grid-cols-1 sm:grid-cols-4 gap-3 items-end">
              <div className="space-y-1">
                <Label htmlFor="ed-res-table">Table</Label>
                <select
                  id="ed-res-table"
                  value={editTableId}
                  onChange={(e) => setEditTableId(e.target.value)}
                  className="flex h-10 w-full rounded-md border border-[var(--rc-border-strong)] bg-[var(--rc-card)] text-[var(--rc-fg)] px-2.5 text-xs"
                >
                  <option value="">Attribution automatique</option>
                  {tenantTables.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.table_number} ({t.capacity} pers.)
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <Label htmlFor="ed-res-size">Couverts</Label>
                <Input
                  id="ed-res-size"
                  type="number"
                  min={1}
                  value={editSize}
                  onChange={(e) => setEditSize(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="ed-res-date">Date &amp; Heure</Label>
                <Input
                  id="ed-res-date"
                  type="datetime-local"
                  value={editDate}
                  onChange={(e) => setEditDate(e.target.value)}
                />
              </div>
              <div className="flex gap-2">
                <Button type="submit" size="sm">Valider</Button>
                <Button type="button" size="sm" variant="outline" onClick={() => setEditingResId(null)}>
                  Annuler
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Plan de salle ({tenantTables.length} tables)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {tenantTables.map((t) => {
              const meta = TABLE_STATUS_META[t.status];
              return (
                <div key={t.id} className="rounded-md border border-[var(--rc-border)] p-3.5 space-y-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-sm font-semibold">{t.table_number}</span>
                    <StatusLabel label={meta.label} tone={meta.tone} />
                  </div>
                  <p className="text-xs text-[var(--rc-muted)]">
                    {t.zone} · {t.capacity} couverts
                  </p>
                  <select
                    aria-label={`État table ${t.table_number}`}
                    value={t.status}
                    onChange={(e) =>
                      updateTableStatus(t.id, e.target.value as RestaurantTableRecord['status'])
                    }
                    className="h-8 w-full rounded-md border border-[var(--rc-border-strong)] bg-[var(--rc-card)] text-[var(--rc-fg)] px-2 text-xs"
                  >
                    <option value="available">Libre</option>
                    <option value="occupied">Occupée</option>
                    <option value="reserved">Réservée</option>
                    <option value="inactive">Fermée</option>
                  </select>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <CardTitle>Réservations clients ({filteredReservations.length})</CardTitle>
          <div className="flex flex-wrap items-center gap-2">
            <select
              aria-label="Filtrer par statut réservation"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as 'all' | ReservationRecord['status'])}
              className="h-9 rounded-md border border-[var(--rc-border-strong)] bg-[var(--rc-card)] text-[var(--rc-fg)] px-2.5 text-xs"
            >
              <option value="all">Tous statuts</option>
              <option value="pending">En attente</option>
              <option value="confirmed">Confirmée</option>
              <option value="rejected">Refusée</option>
              <option value="seated">Installée</option>
              <option value="completed">Terminée</option>
              <option value="cancelled">Annulée</option>
            </select>
            <Input
              type="date"
              aria-label="Filtrer réservations par date"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="h-9 w-36 text-xs"
            />
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto rounded-md border border-[var(--rc-border)]">
            <table className="w-full border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-[var(--rc-border)] bg-[var(--rc-surface-muted)] text-xs font-semibold text-[var(--rc-muted)]">
                  <th className="px-4 py-3">Date &amp; Heure</th>
                  <th className="px-4 py-3">Client</th>
                  <th className="px-4 py-3">Table</th>
                  <th className="px-4 py-3 text-right">Couverts</th>
                  <th className="px-4 py-3">Statut</th>
                  <th className="px-4 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--rc-border)]">
                {filteredReservations.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-xs text-[var(--rc-muted)]">
                      Aucune réservation correspondant aux filtres.
                    </td>
                  </tr>
                ) : (
                  filteredReservations.map((r) => {
                    const meta = RES_STATUS_META[r.status];
                    const tbl = tables.find((t) => t.id === r.table_id);
                    return (
                      <tr key={r.id} className="hover:bg-[var(--rc-card-elevated)]">
                        <td className="px-4 py-3 font-mono text-xs whitespace-nowrap">
                          {r.reserved_for.replace('T', ' ')}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <p className="font-medium">{r.guest_name}</p>
                          <p className="font-mono text-xs text-[var(--rc-muted)]">{r.guest_phone}</p>
                        </td>
                        <td className="px-4 py-3 text-xs text-[var(--rc-muted)] whitespace-nowrap">
                          {tbl ? `${tbl.table_number} (${tbl.zone})` : 'Non assignée'}
                        </td>
                        <td className="px-4 py-3 text-right font-mono tabular-nums">{r.party_size}</td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <StatusLabel label={meta.label} tone={meta.tone} />
                        </td>
                        <td className="px-4 py-3 text-right whitespace-nowrap space-x-1.5">
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            aria-label={`Modifier réservation ${r.guest_name}`}
                            onClick={() => {
                              setEditingResId(r.id);
                              setEditTableId(r.table_id ?? '');
                              setEditSize(String(r.party_size));
                              setEditDate(r.reserved_for);
                            }}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <select
                            aria-label={`Statut réservation ${r.guest_name}`}
                            value={r.status}
                            onChange={(e) =>
                              updateReservationStatus(
                                r.id,
                                e.target.value as ReservationRecord['status']
                              )
                            }
                            className="h-8 rounded-md border border-[var(--rc-border-strong)] bg-[var(--rc-card)] text-[var(--rc-fg)] px-2 text-xs"
                          >
                            <option value="pending">En attente</option>
                            <option value="confirmed">Confirmée</option>
                            <option value="rejected">Refusée</option>
                            <option value="seated">Installée</option>
                            <option value="completed">Terminée</option>
                            <option value="cancelled">Annulée</option>
                            <option value="no_show">Absent</option>
                          </select>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
