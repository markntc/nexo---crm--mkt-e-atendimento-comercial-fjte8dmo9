// src/pages/ConfirmEmailChange.tsx
import React, { useEffect, useState } from 'react'
import { useNavigate, useSearchParams, Link } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Loader2, CheckCircle2 } from 'lucide-react'
import { NtcLogo } from '@/components/NtcLogo'

export default function ConfirmEmailChange() {
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token') || ''
  const navigate = useNavigate()
  const { confirmEmailChange } = useAuth()

  const [password, setPassword] = useState('')
  const [status, setStatus] = useState<'form' | 'loading' | 'success' | 'error'>('form')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!token) {
      setErrorMessage('Token de alteração de e-mail ausente.')
      return
    }
    setErrorMessage(null)
    setStatus('loading')

    try {
      await confirmEmailChange(token, password)
      setStatus('success')
    } catch (err: unknown) {
      console.error('Erro ao confirmar novo e-mail:', err)
      setStatus('error')
      const msg = err instanceof Error ? err.message : 'Falha ao confirmar a alteração do e-mail.'
      setErrorMessage(msg)
    }
  }

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
            Confirmação de Novo E-mail Corporativo
          </p>
        </div>

        <Card className="shadow-sm border-[#D5DBDB] bg-white">
          <CardHeader className="space-y-1 pb-4">
            <CardTitle className="text-xl font-bold text-[#1C2833]">
              Confirmar Novo E-mail
            </CardTitle>
            <CardDescription className="text-[#5D6D7E]">
              Digite sua senha atual para confirmar a migração do e-mail
            </CardDescription>
          </CardHeader>

          {status === 'success' ? (
            <CardContent className="space-y-4 pt-2">
              <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-lg flex items-start space-x-3 text-emerald-800">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 mt-0.5 shrink-0" />
                <div className="text-sm">
                  <p className="font-semibold">E-mail atualizado com sucesso!</p>
                  <p className="mt-1 text-xs text-emerald-700">
                    Sua sessão foi encerrada por segurança. Por favor, autentique-se novamente com
                    seu novo endereço.
                  </p>
                </div>
              </div>
              <Button
                onClick={() => navigate('/login')}
                className="w-full bg-[#1B4F72] hover:bg-[#154360] text-white"
              >
                Acessar Login
              </Button>
            </CardContent>
          ) : (
            <form onSubmit={handleSubmit}>
              <CardContent className="space-y-4">
                {errorMessage && (
                  <Alert
                    variant="destructive"
                    className="bg-red-50 text-red-800 border-red-200 py-2"
                  >
                    <AlertDescription className="text-xs">{errorMessage}</AlertDescription>
                  </Alert>
                )}

                <div className="space-y-1.5">
                  <Label
                    htmlFor="pass"
                    className="text-xs font-semibold uppercase tracking-wider text-[#5D6D7E]"
                  >
                    Senha Atual
                  </Label>
                  <Input
                    id="pass"
                    type="password"
                    required
                    placeholder="Sua senha corporativa"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="h-10 border-[#D5DBDB] focus-visible:ring-[#1B4F72]"
                  />
                </div>
              </CardContent>

              <CardFooter className="flex flex-col space-y-3 pt-2">
                <Button
                  type="submit"
                  disabled={status === 'loading'}
                  className="w-full h-10 font-semibold bg-[#1B4F72] hover:bg-[#154360] text-white transition-colors"
                >
                  {status === 'loading' ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Confirmando...
                    </>
                  ) : (
                    'Confirmar e Desconectar'
                  )}
                </Button>
                <Link
                  to="/login"
                  className="text-xs text-center font-medium text-[#5D6D7E] hover:text-[#1C2833]"
                >
                  Voltar para tela de login
                </Link>
              </CardFooter>
            </form>
          )}
        </Card>
      </div>
    </div>
  )
}
