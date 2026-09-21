import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { ProtectedRoute } from './components/ProtectedRoute'
import { AuthProvider, useAuth } from './lib/auth'
import { DashboardPage } from './pages/DashboardPage'
import { LoginPage } from './pages/LoginPage'
import { ApplicationsPage } from './pages/ApplicationsPage'
import { ApplicationDetailPage } from './pages/ApplicationDetailPage'
import { LoanProductsPage } from './pages/LoanProductsPage'
import { TeamPage } from './pages/TeamPage'
import { CustomersPage } from './pages/CustomersPage'
import { CustomerDetailPage } from './pages/CustomerDetailPage'
import { SettingsPage } from './pages/SettingsPage'

function PublicOnly({ children }: { children: React.ReactNode }) {
  const { token, loading } = useAuth()
  if (loading) return null
  if (token) return <Navigate to="/dashboard" replace />
  return <>{children}</>
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route
            path="/login"
            element={
              <PublicOnly>
                <LoginPage />
              </PublicOnly>
            }
          />
          <Route element={<ProtectedRoute />}>
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/applications" element={<ApplicationsPage />} />
            <Route path="/applications/:id" element={<ApplicationDetailPage />} />
            <Route path="/loan-products" element={<LoanProductsPage />} />
            <Route path="/team" element={<TeamPage />} />
            <Route path="/customers" element={<CustomersPage />} />
            <Route path="/customers/:id" element={<CustomerDetailPage />} />
            <Route path="/settings" element={<SettingsPage />} />
          </Route>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}
