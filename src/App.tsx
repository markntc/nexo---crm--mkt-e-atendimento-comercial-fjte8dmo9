import { Toaster } from '@/components/ui/toaster'
import { TooltipProvider } from '@/components/ui/tooltip'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from '@/contexts/AuthContext'
import { BrandProvider } from '@/contexts/BrandContext'
import { ProtectedRoute } from '@/components/ProtectedRoute'

import Layout from '@/components/Layout'
import Login from '@/pages/Login'
import ForgotPassword from '@/pages/ForgotPassword'
import ResetPassword from '@/pages/ResetPassword'
import VerifyEmail from '@/pages/VerifyEmail'
import ConfirmEmailChange from '@/pages/ConfirmEmailChange'

import Index from '@/pages/Index'
import Pipelines from '@/pages/Pipelines'
import Clientes from '@/pages/Clientes'
import Leads from '@/pages/Leads'
import Oportunidades from '@/pages/Oportunidades'
import Tarefas from '@/pages/Tarefas'
import Conciliacao from '@/pages/Conciliacao'
import Importacao from '@/pages/Importacao'
import Preferencias from '@/pages/Preferencias'
import Relatorios from '@/pages/Relatorios'
import NotFound from '@/pages/NotFound'

const queryClient = new QueryClient()

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <AuthProvider>
          <BrandProvider>
            <BrowserRouter>
              <Routes>
                {/* Rotas Públicas de Autenticação */}
                <Route path="/login" element={<Login />} />
                <Route path="/forgot-password" element={<ForgotPassword />} />
                <Route path="/reset-password" element={<ResetPassword />} />
                <Route path="/verify-email" element={<VerifyEmail />} />
                <Route path="/confirm-email-change" element={<ConfirmEmailChange />} />

                {/* Rotas Protegidas dentro do Layout Corporativo NTC */}
                <Route
                  path="/"
                  element={
                    <ProtectedRoute>
                      <Layout />
                    </ProtectedRoute>
                  }
                >
                  <Route index element={<Index />} />
                  <Route path="pipelines" element={<Pipelines />} />
                  <Route path="clientes" element={<Clientes />} />
                  <Route path="leads" element={<Leads />} />
                  <Route path="oportunidades" element={<Oportunidades />} />
                  <Route path="tarefas" element={<Tarefas />} />
                  <Route path="conciliacao" element={<Conciliacao />} />
                  <Route path="importacao" element={<Importacao />} />
                  <Route path="preferencias" element={<Preferencias />} />
                  <Route path="relatorios" element={<Relatorios />} />
                </Route>

                <Route path="*" element={<NotFound />} />
              </Routes>
            </BrowserRouter>
          </BrandProvider>
        </AuthProvider>
      </TooltipProvider>
    </QueryClientProvider>
  )
}
