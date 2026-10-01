// src/pages/VerifyEmail.tsx
import React, { useEffect, useState } from 'react'
import { useNavigate, useSearchParams, Link } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Loader2, CheckCircle2, XCircle } from 'lucide-react'
import { NtcLogo } from '@/components/NtcLogo'

export default function VerifyEmail() {
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token') || ''
  const navigate = useNavigate()
  const { confirmVerification } = useAuth()

  const [status, setStatus] = useState<'loading' | 'success' | 'error'>(token ? 'loading' : 'error')
  const [errorMessage, setErrorMessage] = useState<string | null>(
    token ? null : 'Nenhum token de validação foi fornecido.',
  )

  useEffect(() => {
    if (!token) return

    let isMounted = true
    confirmVerification(token)
      .then(() => {
        if (isMounted) setStatus('success')
      })
      .catch((err: unknown) => {
        if (isMounted) {
          setStatus('error')
          const msg = err instanceof Error ? err.message : 'Falha ao confirmar o e-mail.'
          setErrorMessage(msg)
        }
      })

    return () => {
      isMounted = false
    }
  }, [token, confirmVerification])

  return (
    <div className="min-h-screen bg-[#F4F6F7] flex flex-col justify-center items-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-6">
          <div className="flex justify-center mb-4">
            <NtcLogo
              variant="full"
              className="w-20 h-20 rounded-2xl shadow-lg ring-1 ring-black/10 p-1.5"
              alt="NTC Company"
            />
          </div>
          <h1 className="text-2xl font-black tracking-tight text-[#060950]">NTC COMPANY</h1>
          <p className="text-xs font-semibold text-[#017848] uppercase tracking-wider mt-0.5">
            Confirmação de Conta Corporativa
          </p>
        </div>

        <Card className="shadow-sm border-[#D5DBDB] bg-white">
          <CardHeader className="space-y-1 pb-4">
            <CardTitle className="text-xl font-bold text-[#1C2833]">
              Verificação de E-mail
            </CardTitle>
            <CardDescription className="text-[#5D6D7E]">
              Validação de identidade corporativa
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-4 pt-2">
            {status === 'loading' && (
              <div className="flex flex-col items-center justify-center py-6 space-y-3">
                <Loader2 className="w-8 h-8 animate-spin text-[#1B4F72]" />
                <p className="text-sm text-[#5D6D7E]">
                  Validando token corporativo com o servidor...
                </p>
              </div>
            )}

            {status === 'success' && (
              <div className="space-y-4">
                <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-lg flex items-start space-x-3 text-emerald-800">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 mt-0.5 shrink-0" />
                  <div className="text-sm">
                    <p className="font-semibold">E-mail verificado com sucesso!</p>
                    <p className="mt-1 text-xs text-emerald-700">
                      Sua conta NTC está homologada para acesso aos funis e carteiras autorizadas.
                    </p>
                  </div>
                </div>
                <Button
                  onClick={() => navigate('/login')}
                  className="w-full bg-[#1B4F72] hover:bg-[#154360] text-white"
                >
                  Entrar no Sistema
                </Button>
              </div>
            )}

            {status === 'error' && (
              <div className="space-y-4">
                <Alert variant="destructive" className="bg-red-50 text-red-800 border-red-200">
                  <XCircle className="w-4 h-4 text-red-600" />
                  <AlertDescription className="text-xs ml-2">
                    {errorMessage || 'Token de verificação inválido ou expirado.'}
                  </AlertDescription>
                </Alert>
                <Link to="/login" className="block">
                  <Button variant="outline" className="w-full border-[#D5DBDB]">
                    Voltar ao Login
                  </Button>
                </Link>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
