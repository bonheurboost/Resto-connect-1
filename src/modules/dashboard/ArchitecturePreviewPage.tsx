import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Lock } from 'lucide-react';
import { Button } from '@/src/components/ui/button';
import { SuperAdminDashboard } from '@/src/modules/super-admin/SuperAdminDashboard';
import { RestaurantAdminDashboard } from './RestaurantAdminDashboard';
import { StaffWorkspace } from '@/src/modules/employees/StaffWorkspace';

type SpacePreviewTab = 'super_admin' | 'restaurant_admin' | 'staff';

export function ArchitecturePreviewPage() {
  const [selectedSpace, setSelectedSpace] = useState<SpacePreviewTab>('super_admin');

  return (
    <div className="min-h-screen bg-[var(--rc-bg)] text-[var(--rc-fg)]">
      <div className="border-b border-[var(--rc-border)] bg-[var(--rc-card)] px-4 sm:px-6 py-2.5">
        <div className="max-w-[1440px] mx-auto flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0 text-xs text-[var(--rc-muted)]">
            <Lock className="h-3.5 w-3.5 text-[var(--rc-gold)] shrink-0" aria-hidden="true" />
            <span className="truncate">
              Aperçu structurel des 3 espaces protégés — les routes réelles exigent une session Supabase Auth active
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-3 shrink-0">
            <div className="inline-flex items-center gap-1 rounded-lg border border-[var(--rc-border)] bg-[var(--rc-surface-muted)] p-1">
              <button
                type="button"
                onClick={() => setSelectedSpace('super_admin')}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  selectedSpace === 'super_admin'
                    ? 'bg-[var(--rc-gold)] text-[#0B0B0B] font-semibold'
                    : 'text-[var(--rc-muted)] hover:text-[var(--rc-fg)]'
                }`}
              >
                A. Super Admin
              </button>
              <button
                type="button"
                onClick={() => setSelectedSpace('restaurant_admin')}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  selectedSpace === 'restaurant_admin'
                    ? 'bg-[var(--rc-gold)] text-[#0B0B0B] font-semibold'
                    : 'text-[var(--rc-muted)] hover:text-[var(--rc-fg)]'
                }`}
              >
                B. Admin Restaurant
              </button>
              <button
                type="button"
                onClick={() => setSelectedSpace('staff')}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  selectedSpace === 'staff'
                    ? 'bg-[var(--rc-gold)] text-[#0B0B0B] font-semibold'
                    : 'text-[var(--rc-muted)] hover:text-[var(--rc-fg)]'
                }`}
              >
                C. Personnel
              </button>
            </div>

            <Button asChild variant="outline" size="sm">
              <Link to="/login">
                <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                <span>Connexion</span>
              </Link>
            </Button>
          </div>
        </div>
      </div>

      {selectedSpace === 'super_admin' && <SuperAdminDashboard isPreviewMode />}
      {selectedSpace === 'restaurant_admin' && <RestaurantAdminDashboard isPreviewMode />}
      {selectedSpace === 'staff' && <StaffWorkspace isPreviewMode />}
    </div>
  );
}
