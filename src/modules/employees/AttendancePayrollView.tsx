import { useState, type FormEvent } from 'react';
import { Clock, Banknote, CalendarOff, CheckCircle2, AlertCircle } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/src/components/ui/card';
import { Button } from '@/src/components/ui/button';
import { Input } from '@/src/components/ui/input';
import { Label } from '@/src/components/ui/label';
import { StatusLabel } from '@/src/components/layout/StatusLabel';
import { useRestoStore } from '@/src/lib/store/RestoConnectStore';
import { formatMoney } from '@/src/lib/domain/operations';
import type { AttendanceRecord, CurrencyCode, SalaryPaymentRecord } from '@/src/lib/supabase/database.types';

interface AttendancePayrollViewProps {
  restaurantId?: string;
}

export function AttendancePayrollView({ restaurantId }: AttendancePayrollViewProps) {
  const {
    activeTenantId,
    restaurants,
    employees,
    attendanceRecords,
    leaveRequests,
    payrollRecords,
    salaryPayments,
    recordCheckIn,
    recordCheckOut,
    createLeaveRequest,
    updateLeaveStatus,
    generatePayrollRecord,
    recordSalaryPayment,
  } = useRestoStore();

  const tenantId = restaurantId ?? activeTenantId;
  const restaurant = restaurants.find((r) => r.id === tenantId);
  const defaultCurr: CurrencyCode = restaurant?.default_currency ?? 'USD';

  const tenantEmployees = employees.filter((e) => e.restaurant_id === tenantId && e.is_active);
  const tenantAttendance = attendanceRecords.filter((a) => a.restaurant_id === tenantId);
  const tenantLeaves = leaveRequests.filter((l) => l.restaurant_id === tenantId);
  const tenantPayrolls = payrollRecords.filter((p) => p.restaurant_id === tenantId);
  const tenantSalaryPayments = salaryPayments.filter((sp) => sp.restaurant_id === tenantId);

  const [tab, setTab] = useState<'attendance' | 'payroll'>('attendance');
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Présences
  const [attEmpId, setAttEmpId] = useState(tenantEmployees[0]?.id ?? '');
  const [attDate, setAttDate] = useState(new Date().toISOString().slice(0, 10));
  const [attStatus, setAttStatus] = useState<AttendanceRecord['status']>('present');
  const [attDelay, setAttDelay] = useState('0');
  const [attNote, setAttNote] = useState('');

  // Congés
  const [lvEmpId, setLvEmpId] = useState(tenantEmployees[0]?.id ?? '');
  const [lvStart, setLvStart] = useState(new Date().toISOString().slice(0, 10));
  const [lvEnd, setLvEnd] = useState(new Date().toISOString().slice(0, 10));
  const [lvType, setLvType] = useState('Congé annuel');

  // Paie
  const [payEmpId, setPayEmpId] = useState(tenantEmployees[0]?.id ?? '');
  const [payPeriod, setPayPeriod] = useState('Novembre 2026');
  const [payBase, setPayBase] = useState(String(tenantEmployees[0]?.salary_amount ?? 0));
  const [payBonus, setPayBonus] = useState('0');
  const [payAdvances, setPayAdvances] = useState('0');
  const [payDeductions, setPayDeductions] = useState('0');
  const [payCurr, setPayCurr] = useState<CurrencyCode>(defaultCurr);

  // Paiement réel salaire
  const [payingPayrollId, setPayingPayrollId] = useState<string | null>(null);
  const [salPayAmount, setSalPayAmount] = useState('');
  const [salPayMethod, setSalPayMethod] = useState<SalaryPaymentRecord['payment_method']>('cash');
  const [salPayRef, setSalPayRef] = useState('');

  function handleCheckIn(e: FormEvent) {
    e.preventDefault();
    const targetEmp = attEmpId || tenantEmployees[0]?.id;
    if (!targetEmp) return;
    const res = recordCheckIn({
      restaurantId: tenantId,
      employeeId: targetEmp,
      attendanceDate: attDate,
      status: attStatus,
      delayMinutes: Number(attDelay) || 0,
      note: attNote,
    });
    if (!res.ok) {
      setFeedback({ type: 'error', text: res.error });
      return;
    }
    setAttNote('');
    setFeedback({ type: 'success', text: 'Pointage enregistré.' });
  }

  function handleLeaveSubmit(e: FormEvent) {
    e.preventDefault();
    const targetEmp = lvEmpId || tenantEmployees[0]?.id;
    if (!targetEmp) return;
    const res = createLeaveRequest({
      restaurantId: tenantId,
      employeeId: targetEmp,
      startDate: lvStart,
      endDate: lvEnd,
      leaveType: lvType,
    });
    if (!res.ok) {
      setFeedback({ type: 'error', text: res.error });
      return;
    }
    setFeedback({ type: 'success', text: 'Demande de congé enregistrée.' });
  }

  function handleGeneratePayroll(e: FormEvent) {
    e.preventDefault();
    const targetEmp = payEmpId || tenantEmployees[0]?.id;
    if (!targetEmp) return;
    const res = generatePayrollRecord({
      restaurantId: tenantId,
      employeeId: targetEmp,
      periodLabel: payPeriod,
      periodStart: '2026-11-01',
      periodEnd: '2026-11-30',
      baseSalary: Number(payBase) || 0,
      bonuses: Number(payBonus) || 0,
      advances: Number(payAdvances) || 0,
      deductions: Number(payDeductions) || 0,
      currency: payCurr,
    });
    if (!res.ok) {
      setFeedback({ type: 'error', text: res.error });
      return;
    }
    setFeedback({
      type: 'success',
      text: `Fiche de paie validée — Net à payer : ${formatMoney(res.payroll.net_salary, res.payroll.currency)}.`,
    });
  }

  function handlePaySalary(e: FormEvent) {
    e.preventDefault();
    if (!payingPayrollId) return;
    const res = recordSalaryPayment({
      restaurantId: tenantId,
      payrollId: payingPayrollId,
      amountPaid: Number(salPayAmount) || 0,
      paymentMethod: salPayMethod,
      referenceCode: salPayRef,
    });
    if (!res.ok) {
      setFeedback({ type: 'error', text: res.error });
      return;
    }
    setPayingPayrollId(null);
    setSalPayRef('');
    setFeedback({ type: 'success', text: 'Paiement de salaire enregistré avec justificatif.' });
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex items-center gap-1 rounded-lg border border-[var(--rc-border)] bg-[var(--rc-surface-muted)] p-1">
          <button
            type="button"
            onClick={() => setTab('attendance')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md cursor-pointer transition-colors ${
              tab === 'attendance'
                ? 'bg-[var(--rc-gold)] text-[#0B0B0B] font-semibold'
                : 'text-[var(--rc-muted)] hover:text-[var(--rc-fg)]'
            }`}
          >
            Présences &amp; Congés ({tenantAttendance.length})
          </button>
          <button
            type="button"
            onClick={() => setTab('payroll')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md cursor-pointer transition-colors ${
              tab === 'payroll'
                ? 'bg-[var(--rc-gold)] text-[#0B0B0B] font-semibold'
                : 'text-[var(--rc-muted)] hover:text-[var(--rc-fg)]'
            }`}
          >
            Salaires &amp; Paiements ({tenantPayrolls.length})
          </button>
        </div>
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

      {tab === 'attendance' ? (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Clock className="h-4 w-4 text-[var(--rc-gold)]" aria-hidden="true" />
                  <span>Pointer une arrivée / présence</span>
                </CardTitle>
                <CardDescription>Contrôle anti-doublon quotidien par employé.</CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleCheckIn} className="grid grid-cols-2 gap-3">
                  <div className="col-span-2 space-y-1.5">
                    <Label htmlFor="att-emp">Collaborateur</Label>
                    <select
                      id="att-emp"
                      value={attEmpId || tenantEmployees[0]?.id || ''}
                      onChange={(e) => setAttEmpId(e.target.value)}
                      className="flex h-10 w-full rounded-md border border-[var(--rc-border-strong)] bg-[var(--rc-card)] text-[var(--rc-fg)] px-3 text-sm"
                    >
                      {tenantEmployees.length === 0 ? (
                        <option value="">Aucun employé actif</option>
                      ) : (
                        tenantEmployees.map((emp) => (
                          <option key={emp.id} value={emp.id}>
                            {emp.full_name} — {emp.job_title}
                          </option>
                        ))
                      )}
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="att-date">Date</Label>
                    <Input id="att-date" type="date" value={attDate} onChange={(e) => setAttDate(e.target.value)} required />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="att-status">Statut</Label>
                    <select
                      id="att-status"
                      value={attStatus}
                      onChange={(e) => setAttStatus(e.target.value as AttendanceRecord['status'])}
                      className="flex h-10 w-full rounded-md border border-[var(--rc-border-strong)] bg-[var(--rc-card)] text-[var(--rc-fg)] px-2.5 text-xs"
                    >
                      <option value="present">Présent</option>
                      <option value="late">En retard</option>
                      <option value="absent">Absent</option>
                      <option value="leave">En congé</option>
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="att-delay">Retard (min)</Label>
                    <Input id="att-delay" type="number" min="0" value={attDelay} onChange={(e) => setAttDelay(e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="att-note">Note</Label>
                    <Input id="att-note" value={attNote} onChange={(e) => setAttNote(e.target.value)} />
                  </div>
                  <div className="col-span-2">
                    <Button type="submit" size="sm" className="w-full">
                      Enregistrer le pointage
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <CalendarOff className="h-4 w-4 text-[var(--rc-gold)]" aria-hidden="true" />
                  <span>Demandes de congé</span>
                </CardTitle>
                <CardDescription>Validation des absences planifiées.</CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleLeaveSubmit} className="grid grid-cols-2 gap-3">
                  <div className="col-span-2 space-y-1.5">
                    <Label htmlFor="lv-emp">Collaborateur</Label>
                    <select
                      id="lv-emp"
                      value={lvEmpId || tenantEmployees[0]?.id || ''}
                      onChange={(e) => setLvEmpId(e.target.value)}
                      className="flex h-10 w-full rounded-md border border-[var(--rc-border-strong)] bg-[var(--rc-card)] text-[var(--rc-fg)] px-3 text-sm"
                    >
                      {tenantEmployees.length === 0 ? (
                        <option value="">Aucun employé actif</option>
                      ) : (
                        tenantEmployees.map((emp) => (
                          <option key={emp.id} value={emp.id}>{emp.full_name}</option>
                        ))
                      )}
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="lv-start">Du</Label>
                    <Input id="lv-start" type="date" value={lvStart} onChange={(e) => setLvStart(e.target.value)} required />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="lv-end">Au</Label>
                    <Input id="lv-end" type="date" value={lvEnd} onChange={(e) => setLvEnd(e.target.value)} required />
                  </div>
                  <div className="col-span-2 space-y-1.5">
                    <Label htmlFor="lv-type">Type</Label>
                    <Input id="lv-type" value={lvType} onChange={(e) => setLvType(e.target.value)} />
                  </div>
                  <div className="col-span-2">
                    <Button type="submit" size="sm" variant="outline" className="w-full">
                      Enregistrer le congé
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Feuille de présence ({tenantAttendance.length})</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto rounded-md border border-[var(--rc-border)]">
                <table className="w-full border-collapse text-left text-sm">
                  <thead>
                    <tr className="border-b border-[var(--rc-border)] bg-[var(--rc-surface-muted)] text-xs font-semibold text-[var(--rc-muted)]">
                      <th className="px-4 py-3">Date</th>
                      <th className="px-4 py-3">Collaborateur</th>
                      <th className="px-4 py-3">Arrivée / Sortie</th>
                      <th className="px-4 py-3">Statut</th>
                      <th className="px-4 py-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--rc-border)]">
                    {tenantAttendance.map((att) => {
                      const emp = employees.find((e) => e.id === att.employee_id);
                      return (
                        <tr key={att.id} className="hover:bg-[var(--rc-card-elevated)]">
                          <td className="px-4 py-3 font-mono text-xs whitespace-nowrap">{att.attendance_date}</td>
                          <td className="px-4 py-3 font-medium">{emp?.full_name ?? att.employee_id}</td>
                          <td className="px-4 py-3 font-mono text-xs text-[var(--rc-muted)] whitespace-nowrap">
                            {att.check_in_at ? att.check_in_at.slice(11, 16) : '—'} →{' '}
                            {att.check_out_at ? att.check_out_at.slice(11, 16) : 'En poste'}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <StatusLabel
                              label={
                                att.status === 'present'
                                  ? 'Présent'
                                  : att.status === 'late'
                                    ? `Retard (${att.delay_minutes} min)`
                                    : att.status === 'leave'
                                      ? 'Congé'
                                      : 'Absent'
                              }
                              tone={
                                att.status === 'present'
                                  ? 'emerald'
                                  : att.status === 'late'
                                    ? 'amber'
                                    : 'crimson'
                              }
                            />
                          </td>
                          <td className="px-4 py-3 text-right">
                            {att.check_in_at && !att.check_out_at && (
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  const r = recordCheckOut(att.id);
                                  if (!r.ok) setFeedback({ type: 'error', text: r.error });
                                  else setFeedback({ type: 'success', text: 'Heure de sortie pointée.' });
                                }}
                              >
                                Pointer la sortie
                              </Button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {tenantLeaves.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Congés déclarés ({tenantLeaves.length})</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {tenantLeaves.map((lv) => {
                  const emp = employees.find((e) => e.id === lv.employee_id);
                  return (
                    <div key={lv.id} className="flex flex-wrap items-center justify-between gap-3 rounded border border-[var(--rc-border)] p-3 text-xs">
                      <div>
                        <p className="font-semibold">{emp?.full_name} — {lv.leave_type}</p>
                        <p className="font-mono text-[var(--rc-muted)]">{lv.start_date} → {lv.end_date}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <StatusLabel
                          label={lv.status === 'approved' ? 'Approuvé' : lv.status === 'rejected' ? 'Refusé' : 'En attente'}
                          tone={lv.status === 'approved' ? 'emerald' : lv.status === 'rejected' ? 'crimson' : 'amber'}
                        />
                        {lv.status === 'pending' && (
                          <>
                            <Button type="button" size="sm" onClick={() => updateLeaveStatus(lv.id, 'approved')}>
                              Approuver
                            </Button>
                            <Button type="button" size="sm" variant="outline" onClick={() => updateLeaveStatus(lv.id, 'rejected')}>
                              Refuser
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          )}
        </div>
      ) : (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Banknote className="h-4 w-4 text-[var(--rc-gold)]" aria-hidden="true" />
                <span>Calculer &amp; Valider une fiche de paie</span>
              </CardTitle>
              <CardDescription>
                Net à payer = Salaire de base + Primes − Avances − Retenues.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleGeneratePayroll} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 items-end">
                <div className="space-y-1.5">
                  <Label htmlFor="pay-emp">Collaborateur</Label>
                  <select
                    id="pay-emp"
                    value={payEmpId || tenantEmployees[0]?.id || ''}
                    onChange={(e) => {
                      const emp = tenantEmployees.find((em) => em.id === e.target.value);
                      setPayEmpId(e.target.value);
                      if (emp) {
                        setPayBase(String(emp.salary_amount ?? 0));
                        setPayCurr(emp.salary_currency ?? defaultCurr);
                      }
                    }}
                    className="flex h-10 w-full rounded-md border border-[var(--rc-border-strong)] bg-[var(--rc-card)] text-[var(--rc-fg)] px-3 text-sm"
                  >
                    {tenantEmployees.length === 0 ? (
                      <option value="">Aucun employé actif</option>
                    ) : (
                      tenantEmployees.map((emp) => (
                        <option key={emp.id} value={emp.id}>{emp.full_name}</option>
                      ))
                    )}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="pay-per">Période</Label>
                  <Input id="pay-per" value={payPeriod} onChange={(e) => setPayPeriod(e.target.value)} required />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="pay-base">Salaire de base</Label>
                  <div className="flex gap-1">
                    <Input id="pay-base" type="number" step="0.01" value={payBase} onChange={(e) => setPayBase(e.target.value)} />
                    <select
                      aria-label="Devise paie"
                      value={payCurr}
                      onChange={(e) => setPayCurr(e.target.value as CurrencyCode)}
                      className="h-10 rounded-md border border-[var(--rc-border-strong)] bg-[var(--rc-card)] text-[var(--rc-fg)] px-2 text-xs"
                    >
                      <option value="USD">USD</option>
                      <option value="CDF">CDF</option>
                    </select>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="pay-bonus">Primes</Label>
                  <Input id="pay-bonus" type="number" step="0.01" value={payBonus} onChange={(e) => setPayBonus(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="pay-adv">Avances</Label>
                  <Input id="pay-adv" type="number" step="0.01" value={payAdvances} onChange={(e) => setPayAdvances(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="pay-ded">Retenues</Label>
                  <Input id="pay-ded" type="number" step="0.01" value={payDeductions} onChange={(e) => setPayDeductions(e.target.value)} />
                </div>
                <div className="sm:col-span-2 flex justify-end">
                  <Button type="submit" size="sm">Générer le bulletin</Button>
                </div>
              </form>
            </CardContent>
          </Card>

          {payingPayrollId && (
            <Card className="border-[var(--rc-gold)]">
              <CardHeader>
                <CardTitle className="text-base">Enregistrer un versement de salaire</CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={handlePaySalary} className="grid grid-cols-1 sm:grid-cols-4 gap-3 items-end">
                  <div className="space-y-1">
                    <Label htmlFor="sp-amt">Montant versé</Label>
                    <Input id="sp-amt" type="number" step="0.01" value={salPayAmount} onChange={(e) => setSalPayAmount(e.target.value)} required />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="sp-meth">Méthode</Label>
                    <select
                      id="sp-meth"
                      value={salPayMethod}
                      onChange={(e) => setSalPayMethod(e.target.value as SalaryPaymentRecord['payment_method'])}
                      className="flex h-10 w-full rounded-md border border-[var(--rc-border-strong)] bg-[var(--rc-card)] text-[var(--rc-fg)] px-2.5 text-xs"
                    >
                      <option value="cash">Espèces</option>
                      <option value="mobile_money">Mobile Money</option>
                      <option value="bank_transfer">Virement bancaire</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="sp-ref">Référence reçu *</Label>
                    <Input id="sp-ref" placeholder="PAIE-2026-..." value={salPayRef} onChange={(e) => setSalPayRef(e.target.value)} required />
                  </div>
                  <div className="flex gap-2">
                    <Button type="submit" size="sm">Confirmer versement</Button>
                    <Button type="button" size="sm" variant="outline" onClick={() => setPayingPayrollId(null)}>
                      Annuler
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle>Bulletins &amp; Paiements ({tenantPayrolls.length})</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto rounded-md border border-[var(--rc-border)]">
                <table className="w-full border-collapse text-left text-sm">
                  <thead>
                    <tr className="border-b border-[var(--rc-border)] bg-[var(--rc-surface-muted)] text-xs font-semibold text-[var(--rc-muted)]">
                      <th className="px-4 py-3">Employé</th>
                      <th className="px-4 py-3">Période</th>
                      <th className="px-4 py-3 text-right">Net à payer</th>
                      <th className="px-4 py-3 text-right">Déjà versé</th>
                      <th className="px-4 py-3">Statut</th>
                      <th className="px-4 py-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--rc-border)]">
                    {tenantPayrolls.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-4 py-8 text-center text-xs text-[var(--rc-muted)]">
                          Aucun bulletin généré.
                        </td>
                      </tr>
                    ) : (
                      tenantPayrolls.map((pr) => {
                        const emp = employees.find((e) => e.id === pr.employee_id);
                        const paidSum = tenantSalaryPayments
                          .filter((sp) => sp.payroll_id === pr.id)
                          .reduce((s, sp) => s + sp.amount_paid, 0);
                        return (
                          <tr key={pr.id}>
                            <td className="px-4 py-3 font-medium">{emp?.full_name ?? pr.employee_id}</td>
                            <td className="px-4 py-3 text-xs text-[var(--rc-muted)]">{pr.period_label}</td>
                            <td className="px-4 py-3 text-right font-mono tabular-nums">
                              {formatMoney(pr.net_salary, pr.currency)}
                            </td>
                            <td className="px-4 py-3 text-right font-mono tabular-nums text-[var(--rc-gold-text)]">
                              {formatMoney(paidSum, pr.currency)}
                            </td>
                            <td className="px-4 py-3">
                              <StatusLabel
                                label={pr.status === 'paid' ? 'Payé' : 'Validé'}
                                tone={pr.status === 'paid' ? 'emerald' : 'amber'}
                              />
                            </td>
                            <td className="px-4 py-3 text-right">
                              {pr.status !== 'paid' && (
                                <Button
                                  type="button"
                                  size="sm"
                                  onClick={() => {
                                    setPayingPayrollId(pr.id);
                                    setSalPayAmount(String(Math.max(0, pr.net_salary - paidSum)));
                                  }}
                                >
                                  Verser salaire
                                </Button>
                              )}
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
      )}
    </div>
  );
}
