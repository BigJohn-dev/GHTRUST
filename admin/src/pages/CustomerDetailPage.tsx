import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import clsx from 'clsx'
import {
  ArrowLeft,
  Banknote,
  Building2,
  Calendar,
  CreditCard,
  FileText,
  Mail,
  MapPin,
  Phone,
  User,
} from 'lucide-react'
import { AdminLayout } from '../components/AdminLayout'
import { PermissionGate } from '../components/PermissionGate'
import { StatusPill } from '../components/ui'
import { useAuth } from '../lib/auth'
import { customersApi, formatCustomerAge, formatDate, type CustomerDetail } from '../lib/customersApi'
import { formatNaira } from '../lib/loansApi'
import { initials } from '../lib/productMeta'
import { ApiError } from '../lib/api'

export function CustomerDetailPage() {
  return (
    <PermissionGate permission="loan:read">
      <CustomerDetailContent />
    </PermissionGate>
  )
}

function CustomerDetailContent() {
  const { id } = useParams<{ id: string }>()
  const { token } = useAuth()
  const [customer, setCustomer] = useState<CustomerDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    if (!token || !id) return
    setLoading(true)
    setError('')
    try {
      setCustomer(await customersApi.get(token, id))
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load customer')
    } finally {
      setLoading(false)
    }
  }, [token, id])

  useEffect(() => { load() }, [load])

  if (loading) {
    return (
      <AdminLayout title="Customer profile">
        <div className="flex items-center justify-center py-24">
          <div className="h-10 w-10 rounded-full border-2 border-slate-200 border-t-[#1b2f6b] animate-spin" />
        </div>
      </AdminLayout>
    )
  }

  if (error || !customer) {
    return (
      <AdminLayout title="Customer profile">
        <div className="dash-card p-8 text-center">
          <p className="text-rose-600 font-medium">{error || 'Customer not found'}</p>
          <Link to="/customers" className="inline-block mt-4 text-[13px] font-semibold text-[#1b2f6b] hover:underline">
            Back to customers
          </Link>
        </div>
      </AdminLayout>
    )
  }

  return (
    <AdminLayout title={customer.full_name} subtitle={`CASA ${customer.account_number}`}>
      <Link
        to="/customers"
        className="inline-flex items-center gap-1.5 text-[13px] font-medium text-slate-500 hover:text-[#1b2f6b] mb-6 transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to customers
      </Link>

      {/* Hero */}
      <div className="dash-card overflow-hidden mb-6">
        <div className="h-2 bg-[#1b2f6b]" />
        <div className="p-6 lg:p-8">
          <div className="flex flex-wrap items-start justify-between gap-6">
            <div className="flex items-start gap-4">
              <div className="h-16 w-16 rounded-2xl flex items-center justify-center text-lg font-bold bg-slate-100 text-[#1b2f6b] ring-1 ring-slate-200">
                {initials(customer.full_name)}
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-3">
                  <h2 className="text-2xl font-semibold text-slate-900 tracking-tight">{customer.full_name}</h2>
                  <CustomerStatusPill status={customer.status} />
                  {customer.phone_verified && (
                    <span className="text-[9px] font-bold uppercase px-2 py-0.5 rounded bg-emerald-50 text-emerald-700">
                      Phone verified
                    </span>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-3 mt-2 text-[12px] text-slate-500">
                  <span className="font-mono font-semibold text-[#1b2f6b]">{customer.account_number}</span>
                  <span>·</span>
                  <span>BVN {customer.bvn_masked}</span>
                  <span>·</span>
                  <span>{customer.branch}</span>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { label: 'Applications', value: String(customer.stats.total_applications) },
                { label: 'Active', value: String(customer.stats.active_applications) },
                { label: 'Disbursed', value: String(customer.stats.disbursed_count) },
                { label: 'Total disbursed', value: formatNaira(customer.stats.total_disbursed_amount) },
              ].map((s) => (
                <div key={s.label} className="px-4 py-3 rounded-xl bg-slate-50 ring-1 ring-slate-100 text-center min-w-[100px]">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">{s.label}</p>
                  <p className="text-[14px] font-bold text-slate-900 mt-1 tabular-nums">{s.value}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="grid xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2 space-y-6">
          {/* Identity & contact */}
          <div className="dash-card p-6">
            <h3 className="text-[14px] font-semibold text-slate-900 mb-4">Personal information</h3>
            <div className="grid sm:grid-cols-2 gap-4">
              <InfoItem icon={User} label="Full name" value={customer.full_name} />
              <InfoItem icon={User} label="Gender" value={customer.gender ?? '—'} />
              <InfoItem icon={Calendar} label="Date of birth" value={`${formatDate(customer.date_of_birth)} (${formatCustomerAge(customer.date_of_birth)})`} />
              <InfoItem icon={User} label="Marital status" value={customer.marital_status ?? '—'} />
              <InfoItem icon={Phone} label="Primary phone" value={customer.phone} />
              <InfoItem icon={Phone} label="Secondary phone" value={customer.phone_secondary ?? '—'} />
              <InfoItem icon={Mail} label="Email" value={customer.email ?? '—'} />
              <InfoItem icon={MapPin} label="Nationality" value={customer.nationality ?? '—'} />
            </div>
          </div>

          {/* Address */}
          <div className="dash-card p-6">
            <h3 className="text-[14px] font-semibold text-slate-900 mb-4">Address & origin</h3>
            <div className="grid sm:grid-cols-2 gap-4">
              <InfoItem icon={MapPin} label="Residential address" value={customer.residential_address ?? '—'} />
              <InfoItem icon={MapPin} label="State of residence" value={customer.state_of_residence ?? '—'} />
              <InfoItem icon={MapPin} label="LGA of residence" value={customer.lga_of_residence ?? '—'} />
              <InfoItem icon={MapPin} label="State of origin" value={customer.state_of_origin ?? '—'} />
              <InfoItem icon={MapPin} label="LGA of origin" value={customer.lga_of_origin ?? '—'} />
            </div>
          </div>

          {/* Banking */}
          <div className="dash-card p-6">
            <h3 className="text-[14px] font-semibold text-slate-900 mb-4">Banking & BVN</h3>
            <div className="grid sm:grid-cols-2 gap-4">
              <InfoItem icon={CreditCard} label="Account number" value={customer.account_number} />
              <InfoItem icon={CreditCard} label="BVN" value={customer.bvn_masked} />
              <InfoItem icon={Building2} label="Enrollment bank" value={customer.enrollment_bank ?? '—'} />
              <InfoItem icon={Building2} label="Enrollment branch" value={customer.enrollment_branch ?? '—'} />
              <InfoItem icon={Banknote} label="Account level" value={customer.level_of_account ?? '—'} />
              <InfoItem icon={CreditCard} label="Name on card" value={customer.name_on_card ?? '—'} />
            </div>
          </div>

          {/* Loan history */}
          <div className="dash-card overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50">
              <h3 className="text-[14px] font-semibold text-slate-900">Loan applications</h3>
              <p className="text-[11px] text-slate-400 mt-0.5">{customer.loan_applications.length} total</p>
            </div>
            {customer.loan_applications.length === 0 ? (
              <p className="px-6 py-10 text-center text-[13px] text-slate-400">No loan applications yet</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[640px]">
                  <thead>
                    <tr className="text-left text-[10px] font-bold text-slate-400 uppercase tracking-widest border-b border-slate-100">
                      <th className="px-6 py-3">Product</th>
                      <th className="px-6 py-3">Amount</th>
                      <th className="px-6 py-3">Stage</th>
                      <th className="px-6 py-3">Submitted</th>
                      <th className="px-6 py-3">Status</th>
                      <th className="px-6 py-3 w-20" />
                    </tr>
                  </thead>
                  <tbody>
                    {customer.loan_applications.map((app) => (
                      <tr key={app.id} className="border-t border-slate-100 hover:bg-slate-50/60">
                        <td className="px-6 py-3.5">
                          <p className="text-[13px] font-semibold text-slate-900">{app.product_name}</p>
                          <p className="text-[11px] text-slate-400 font-mono">{app.id.slice(0, 8)}</p>
                        </td>
                        <td className="px-6 py-3.5 text-[13px] font-semibold text-slate-800 tabular-nums">
                          {formatNaira(app.requested_amount)}
                        </td>
                        <td className="px-6 py-3.5 text-[12px] text-slate-600">
                          {app.current_stage_name ?? '—'}
                        </td>
                        <td className="px-6 py-3.5 text-[12px] text-slate-400 tabular-nums">
                          {formatDate(app.submitted_at ?? app.created_at)}
                        </td>
                        <td className="px-6 py-3.5">
                          <StatusPill status={app.status} />
                        </td>
                        <td className="px-6 py-3.5">
                          <Link
                            to={`/applications/${app.id}`}
                            className="text-[12px] font-semibold text-[#1b2f6b] hover:underline"
                          >
                            View
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          <div className="dash-card p-6">
            <h3 className="text-[14px] font-semibold text-slate-900 mb-4">Account activity</h3>
            <dl className="space-y-3 text-[13px]">
              <div className="flex justify-between gap-4">
                <dt className="text-slate-400">Customer since</dt>
                <dd className="font-medium text-slate-800 tabular-nums">{formatDate(customer.created_at)}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-slate-400">Last login</dt>
                <dd className="font-medium text-slate-800 tabular-nums">{formatDate(customer.last_login_at)}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-slate-400">Phone verified</dt>
                <dd className="font-medium text-slate-800">{customer.phone_verified ? 'Yes' : 'No'}</dd>
              </div>
            </dl>
          </div>

          <div className="dash-card p-6">
            <h3 className="text-[14px] font-semibold text-slate-900 mb-3 flex items-center gap-2">
              <FileText className="h-4 w-4 text-slate-400" />
              Quick summary
            </h3>
            <p className="text-[13px] text-slate-600 leading-relaxed">
              {customer.full_name} has {customer.stats.total_applications} loan application
              {customer.stats.total_applications === 1 ? '' : 's'}
              {customer.stats.disbursed_count > 0
                ? ` with ${customer.stats.disbursed_count} disbursed totalling ${formatNaira(customer.stats.total_disbursed_amount)}.`
                : '.'}
            </p>
          </div>
        </div>
      </div>
    </AdminLayout>
  )
}

function InfoItem({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  value: string
}) {
  return (
    <div className="flex items-start gap-3 p-4 rounded-xl bg-slate-50/80 ring-1 ring-slate-100">
      <div className="h-9 w-9 rounded-lg bg-white ring-1 ring-slate-200/80 flex items-center justify-center shrink-0">
        <Icon className="h-4 w-4 text-slate-400" />
      </div>
      <div className="min-w-0">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{label}</p>
        <p className="text-[13px] font-medium text-slate-800 mt-0.5 break-words">{value}</p>
      </div>
    </div>
  )
}

function CustomerStatusPill({ status }: { status: string }) {
  const styles: Record<string, string> = {
    active: 'bg-emerald-50 text-emerald-700',
    pending_otp: 'bg-amber-50 text-amber-700',
    suspended: 'bg-rose-50 text-rose-700',
    inactive: 'bg-slate-100 text-slate-500',
  }
  return (
    <span className={clsx('inline-flex px-2.5 py-1 rounded-full text-[10px] font-bold uppercase', styles[status] ?? 'bg-slate-100 text-slate-600')}>
      {status.replace(/_/g, ' ')}
    </span>
  )
}
