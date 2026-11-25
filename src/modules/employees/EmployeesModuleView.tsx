import { useMemo, useState, type FormEvent } from 'react';
import { Plus, Search, Pencil } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/src/components/ui/card';
import { Button } from '@/src/components/ui/button';
import { Input } from '@/src/components/ui/input';
import { Label } from '@/src/components/ui/label';
import { StatusLabel } from '@/src/components/layout/StatusLabel';
import { useRestoStore } from '@/src/lib/store/RestoConnectStore';
import { ROLE_LABELS_FR } from '@/src/lib/auth/rbac';
import { formatMoney } from '@/src/lib/domain/operations';
import type { CurrencyCode, EmployeeRecord, RestaurantRoleCode } from '@/src/lib/supabase/database.types';

interface EmployeesModuleViewProps {
  restaurantId?: string;
}

export function EmployeesModuleView({ restaurantId }: EmployeesModuleViewProps) {
  const {
    activeTenantId,
    restaurants,
    employees,
    members,
    userActivityLogs,
    createEmployee,
    updateEmployeeDetails,
    toggleEmployeeActive,
  } = useRestoStore();

  const tenantId = restaurantId ?? activeTenantId;
  const restaurant = restaurants.find((r) => r.id === tenantId);
  const defaultCurr: CurrencyCode = restaurant?.default_currency ?? 'USD';

  const tenantEmployees = employees.filter((e) => e.restaurant_id === tenantId);
  const tenantMembers = members.filter((m) => m.restaurant_id === tenantId);
  const tenantActivity = userActivityLogs.filter((u) => u.restaurant_id === tenantId);

  const [fullName, setFullName] = useState('');
  const [jobTitle, setJobTitle] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [roleCode, setRoleCode] = useState<RestaurantRoleCode>('server');
  const [contractType, setContractType] = useState<EmployeeRecord['contract_type']>('cdi');
  const [salaryAmount, setSalaryAmount] = useState('0');
  const [salaryCurr, setSalaryCurr] = useState<CurrencyCode>(defaultCurr);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Édition d'un membre existant
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editTitle, setEditTitle] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editAddress, setEditAddress] = useState('');
  const [editRole, setEditRole] = useState<RestaurantRoleCode>('server');
  const [editContract, setEditContract] = useState<EmployeeRecord['contract_type']>('cdi');
  const [editSalary, setEditSalary] = useState('0');
  const [editSalaryCurr, setEditSalaryCurr] = useState<CurrencyCode>(defaultCurr);
  const [editEmpStatus, setEditEmpStatus] = useState<NonNullable<EmployeeRecord['employment_status']>>('active');

  const filteredEmployees = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return tenantEmployees;
    return tenantEmployees.filter((emp) => {
      const mem = tenantMembers.find((m) => m.id === emp.member_id);
      const roleLabel = mem ? ROLE_LABELS_FR[mem.role_code].toLowerCase() : '';
      return (
        emp.full_name.toLowerCase().includes(q) ||
        emp.job_title.toLowerCase().includes(q) ||
        (emp.email ?? '').toLowerCase().includes(q) ||
        roleLabel.includes(q)
      );
    });
  }, [tenantEmployees, tenantMembers, searchQuery]);

  function handleAddEmployee(e: FormEvent) {
    e.preventDefault();
    const res = createEmployee({
      restaurantId: tenantId,
      fullName,
      jobTitle,
      email,
      phone,
      address,
      roleCode,
      contractType,
      salaryAmount: Number(salaryAmount) || 0,
      salaryCurrency: salaryCurr,
    });
    if (!res.ok) {
      setFeedback(res.error);
      return;
    }
    setFullName('');
    setJobTitle('');
    setEmail('');
    setPhone('');
    setAddress('');
    setFeedback(`Collaborateur invité. Code sécurisé généré : ${res.invitationCode}`);
  }

  function startEdit(emp: EmployeeRecord) {
    const mem = tenantMembers.find((m) => m.id === emp.member_id);
    setEditingId(emp.id);
    setEditName(emp.full_name);
    setEditTitle(emp.job_title);
    setEditPhone(emp.phone ?? '');
    setEditEmail(emp.email ?? '');
    setEditAddress(emp.address ?? '');
    setEditRole(mem?.role_code ?? 'server');
    setEditContract(emp.contract_type);
    setEditSalary(String(emp.salary_amount ?? 0));
    setEditSalaryCurr(emp.salary_currency ?? defaultCurr);
    setEditEmpStatus(emp.employment_status ?? 'active');
  }

  function saveEdit(e: FormEvent) {
    e.preventDefault();
    if (!editingId) return;
    const res = updateEmployeeDetails(editingId, {
      fullName: editName,
      jobTitle: editTitle,
      phone: editPhone,
      email: editEmail,
      address: editAddress,
      roleCode: editRole,
      contractType: editContract,
      salaryAmount: Number(editSalary) || 0,
      salaryCurrency: editSalaryCurr,
      employmentStatus: editEmpStatus,
    });
    if (res.ok) {
      setEditingId(null);
      setFeedback('Fiche collaborateur mise à jour.');
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Inviter &amp; Ajouter un membre du personnel</CardTitle>
          <CardDescription>
            Fiche RH complète (poste, contrat, salaire de base) et code d&apos;invitation sécurisé rattaché à cet établissement.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleAddEmployee} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="emp-name">Nom complet *</Label>
              <Input
                id="emp-name"
                placeholder="Nom complet"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="emp-title">Poste *</Label>
              <Input
                id="emp-title"
                placeholder="ex: Chef de rang"
                value={jobTitle}
                onChange={(e) => setJobTitle(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="emp-email">E-mail professionnel *</Label>
              <Input
                id="emp-email"
                type="email"
                placeholder="email@exemple.cd"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="emp-phone">Téléphone</Label>
              <Input
                id="emp-phone"
                placeholder="+243 ..."
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="emp-addr">Adresse</Label>
              <Input
                id="emp-addr"
                placeholder="Commune / Quartier"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="emp-role">Rôle attribué</Label>
              <select
                id="emp-role"
                value={roleCode}
                onChange={(e) => setRoleCode(e.target.value as RestaurantRoleCode)}
                className="flex h-10 w-full rounded-md border border-[var(--rc-border-strong)] bg-[var(--rc-card)] text-[var(--rc-fg)] px-3 text-sm"
              >
                <option value="manager">Gestionnaire</option>
                <option value="cashier">Caissier</option>
                <option value="server">Serveur</option>
                <option value="cook">Cuisinier</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="emp-contract">Contrat</Label>
              <select
                id="emp-contract"
                value={contractType}
                onChange={(e) => setContractType(e.target.value as EmployeeRecord['contract_type'])}
                className="flex h-10 w-full rounded-md border border-[var(--rc-border-strong)] bg-[var(--rc-card)] text-[var(--rc-fg)] px-3 text-sm"
              >
                <option value="cdi">CDI</option>
                <option value="cdd">CDD</option>
                <option value="extra">Extra</option>
                <option value="stagiaire">Stagiaire</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="emp-sal">Salaire mensuel de base</Label>
              <div className="flex gap-1.5">
                <Input
                  id="emp-sal"
                  type="number"
                  min="0"
                  step="0.01"
                  value={salaryAmount}
                  onChange={(e) => setSalaryAmount(e.target.value)}
                />
                <select
                  aria-label="Devise salaire"
                  value={salaryCurr}
                  onChange={(e) => setSalaryCurr(e.target.value as CurrencyCode)}
                  className="h-10 rounded-md border border-[var(--rc-border-strong)] bg-[var(--rc-card)] text-[var(--rc-fg)] px-2 text-xs"
                >
                  <option value="USD">USD</option>
                  <option value="CDF">CDF</option>
                </select>
              </div>
            </div>
            <div className="sm:col-span-2 lg:col-span-4 flex items-center justify-between gap-4">
              <span className="text-xs font-medium text-[var(--rc-gold-text)]">{feedback ?? ''}</span>
              <Button type="submit" size="sm">
                <Plus className="h-4 w-4" aria-hidden="true" />
                <span>Créer l&apos;accès personnel</span>
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {editingId && (
        <Card className="border-[var(--rc-gold)]">
          <CardHeader>
            <CardTitle className="text-base">Modifier les informations RH et le rôle</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={saveEdit} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="edit-emp-name">Nom complet</Label>
                <Input id="edit-emp-name" value={editName} onChange={(e) => setEditName(e.target.value)} required />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="edit-emp-title">Poste</Label>
                <Input id="edit-emp-title" value={editTitle} onChange={(e) => setEditTitle(e.target.value)} required />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="edit-emp-role">Rôle RBAC</Label>
                <select
                  id="edit-emp-role"
                  value={editRole}
                  onChange={(e) => setEditRole(e.target.value as RestaurantRoleCode)}
                  className="flex h-10 w-full rounded-md border border-[var(--rc-border-strong)] bg-[var(--rc-card)] text-[var(--rc-fg)] px-3 text-sm"
                >
                  <option value="manager">Gestionnaire</option>
                  <option value="cashier">Caissier</option>
                  <option value="server">Serveur</option>
                  <option value="cook">Cuisinier</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="edit-emp-stat">Statut emploi</Label>
                <select
                  id="edit-emp-stat"
                  value={editEmpStatus}
                  onChange={(e) =>
                    setEditEmpStatus(e.target.value as NonNullable<EmployeeRecord['employment_status']>)
                  }
                  className="flex h-10 w-full rounded-md border border-[var(--rc-border-strong)] bg-[var(--rc-card)] text-[var(--rc-fg)] px-3 text-sm"
                >
                  <option value="active">Actif</option>
                  <option value="on_leave">En congé</option>
                  <option value="suspended">Suspendu</option>
                  <option value="terminated">Fin de contrat</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="edit-emp-phone">Téléphone</Label>
                <Input id="edit-emp-phone" value={editPhone} onChange={(e) => setEditPhone(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="edit-emp-email">E-mail</Label>
                <Input id="edit-emp-email" value={editEmail} onChange={(e) => setEditEmail(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="edit-emp-addr">Adresse</Label>
                <Input id="edit-emp-addr" value={editAddress} onChange={(e) => setEditAddress(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="edit-emp-sal">Salaire de base</Label>
                <div className="flex gap-1.5">
                  <Input
                    id="edit-emp-sal"
                    type="number"
                    min="0"
                    step="0.01"
                    value={editSalary}
                    onChange={(e) => setEditSalary(e.target.value)}
                  />
                  <select
                    aria-label="Devise salaire edit"
                    value={editSalaryCurr}
                    onChange={(e) => setEditSalaryCurr(e.target.value as CurrencyCode)}
                    className="h-10 rounded-md border border-[var(--rc-border-strong)] bg-[var(--rc-card)] text-[var(--rc-fg)] px-2 text-xs"
                  >
                    <option value="USD">USD</option>
                    <option value="CDF">CDF</option>
                  </select>
                </div>
              </div>
              <div className="sm:col-span-2 lg:col-span-4 flex items-center gap-3">
                <Button type="submit" size="sm">Enregistrer</Button>
                <Button type="button" variant="outline" size="sm" onClick={() => setEditingId(null)}>
                  Annuler
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <CardTitle>Équipe de l&apos;établissement ({filteredEmployees.length})</CardTitle>
          <div className="relative sm:w-72">
            <Search className="h-4 w-4 text-[var(--rc-muted)] absolute left-3 top-1/2 -translate-y-1/2" aria-hidden="true" />
            <Input
              aria-label="Rechercher un membre du personnel"
              placeholder="Rechercher par nom, poste ou rôle..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto rounded-md border border-[var(--rc-border)]">
            <table className="w-full border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-[var(--rc-border)] bg-[var(--rc-surface-muted)] text-xs font-semibold text-[var(--rc-muted)]">
                  <th className="px-4 py-3">Nom</th>
                  <th className="px-4 py-3">Poste &amp; Contrat</th>
                  <th className="px-4 py-3">Rôle applicatif</th>
                  <th className="px-4 py-3 text-right">Salaire base</th>
                  <th className="px-4 py-3">Code invitation</th>
                  <th className="px-4 py-3">État</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--rc-border)]">
                {filteredEmployees.map((emp) => {
                  const mem = tenantMembers.find((m) => m.id === emp.member_id);
                  return (
                    <tr key={emp.id} className="hover:bg-[var(--rc-card-elevated)]">
                      <td className="px-4 py-3 whitespace-nowrap">
                        <p className="font-medium">{emp.full_name}</p>
                        {emp.address && <p className="text-xs text-[var(--rc-muted)]">{emp.address}</p>}
                      </td>
                      <td className="px-4 py-3 text-xs text-[var(--rc-muted)] whitespace-nowrap">
                        {emp.job_title} ({emp.contract_type.toUpperCase()})
                      </td>
                      <td className="px-4 py-3 text-xs whitespace-nowrap">
                        {mem ? ROLE_LABELS_FR[mem.role_code] : '—'}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-xs tabular-nums whitespace-nowrap">
                        {formatMoney(emp.salary_amount ?? 0, emp.salary_currency ?? defaultCurr)}
                      </td>
                      <td className="px-4 py-3 font-mono text-xs whitespace-nowrap">
                        {mem?.invitation_code ?? '—'}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <StatusLabel
                          label={emp.is_active ? 'Actif' : 'Désactivé'}
                          tone={emp.is_active ? 'emerald' : 'crimson'}
                        />
                      </td>
                      <td className="px-4 py-3 text-right whitespace-nowrap space-x-1.5">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          aria-label={`Modifier ${emp.full_name}`}
                          onClick={() => startEdit(emp)}
                        >
                          <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => toggleEmployeeActive(emp.id)}
                        >
                          {emp.is_active ? 'Désactiver' : 'Réactiver'}
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Historique d&apos;activité du personnel</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 text-xs">
            {tenantActivity.length === 0 ? (
              <p className="text-[var(--rc-muted)]">Aucun mouvement enregistré pour cet établissement.</p>
            ) : (
              tenantActivity.slice(0, 8).map((u) => (
                <div
                  key={u.id}
                  className="flex items-center justify-between gap-4 border-b border-[var(--rc-border)] pb-2 last:border-b-0"
                >
                  <span>
                    <strong>{u.actor_name}</strong> — {u.action}
                  </span>
                  <span className="font-mono text-[var(--rc-muted)] whitespace-nowrap">
                    {u.created_at.replace('T', ' ').slice(0, 16)}
                  </span>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
