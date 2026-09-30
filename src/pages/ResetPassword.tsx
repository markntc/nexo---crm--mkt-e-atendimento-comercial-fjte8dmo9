// src/pages/ResetPassword.tsx
import React, { useState } from 'react'
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
import { Loader2, CheckCircle2, Layers } from 'lucide-react'

export default function ResetPassword() {
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token') || ''
  const navigate = useNavigate()
  const { confirmPasswordReset } = useAuth()

  const [password, setPassword] = useState('')
  const [passwordConfirm, setPasswordConfirm] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!token) {
      setError('Token de redefinição não encontrado ou inválido na URL.')
      return
    }

    if (password.length < 8) {
      setError('A nova senha deve ter no mínimo 8 caracteres.')
      return
    }

    if (password !== passwordConfirm) {
      setError('A confirmação da senha não coincide com a nova senha.')
      return
    }

    setIsLoading(true)
    try {
      await confirmPasswordReset(token, password, passwordConfirm)
      setSuccess(true)
    } catch (err: unknown) {
      console.error('Erro ao redefinir senha:', err)
      const msg =
        err instanceof Error ? err.message : 'Falha ao redefinir senha. O token pode ter expirado.'
      setError(msg)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#F4F6F7] flex flex-col justify-center items-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-[#1B4F72] text-white shadow-md mb-3">
            <Layers className="w-8 h-8" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-[#1C2833]">
            NTC Sistema Integrado
          </h1>
          <p className="text-sm text-[#5D6D7E] mt-1">Crie sua nova senha de acesso</p>
        </div>

        <Card className="shadow-sm border-[#D5DBDB] bg-white">
          <CardHeader className="space-y-1 pb-4">
            <CardTitle className="text-xl font-bold text-[#1C2833]">Redefinir Senha</CardTitle>
            <CardDescription className="text-[#5D6D7E]">
              Digite sua nova credencial de segurança corporativa
            </CardDescription>
          </CardHeader>

          {success ? (
            <CardContent className="space-y-4 pt-2">
              <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-lg flex items-start space-x-3 text-emerald-800">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 mt-0.5 shrink-0" />
                <div className="text-sm">
                  <p className="font-semibold">Senha alterada com sucesso!</p>
                  <p className="mt-1 text-xs text-emerald-700">
                    Agora você já pode fazer login no sistema com a nova credencial cadastrada.
                  </p>
                </div>
              </div>
              <Button
                onClick={() => navigate('/login')}
                className="w-full bg-[#1B4F72] hover:bg-[#154360] text-white"
              >
                Ir para o Login
              </Button>
            </CardContent>
          ) : (
            <form onSubmit={handleSubmit}>
              <CardContent className="space-y-4">
                {error && (
                  <Alert
                    variant="destructive"
                    className="bg-red-50 text-red-800 border-red-200 py-2"
                  >
                    <AlertDescription className="text-xs">{error}</AlertDescription>
                  </Alert>
                )}

                {!token && (
                  <Alert className="bg-amber-50 text-amber-900 border-amber-200 py-2">
                    <AlertDescription className="text-xs">
                      Atenção: nenhum token foi identificado na URL. Solicite um novo link se
                      necessário.
                    </AlertDescription>
                  </Alert>
                )}

                <div className="space-y-1.5">
                  <Label
                    htmlFor="pass"
                    className="text-xs font-semibold uppercase tracking-wider text-[#5D6D7E]"
                  >
                    Nova Senha
                  </Label>
                  <Input
                    id="pass"
                    type="password"
                    required
                    placeholder="Mínimo 8 caracteres"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="h-10 border-[#D5DBDB] focus-visible:ring-[#1B4F72]"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label
                    htmlFor="passConfirm"
                    className="text-xs font-semibold uppercase tracking-wider text-[#5D6D7E]"
                  >
                    Confirmar Nova Senha
                  </Label>
                  <Input
                    id="passConfirm"
                    type="password"
                    required
                    placeholder="Repita a nova senha"
                    value={passwordConfirm}
                    onChange={(e) => setPasswordConfirm(e.target.value)}
                    className="h-10 border-[#D5DBDB] focus-visible:ring-[#1B4F72]"
                  />
                </div>
              </CardContent>

              <CardFooter className="flex flex-col space-y-3 pt-2">
                <Button
                  type="submit"
                  disabled={isLoading || !token}
                  className="w-full h-10 font-semibold bg-[#1B4F72] hover:bg-[#154360] text-white transition-colors"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Salvando nova senha...
                    </>
                  ) : (
                    'Salvar Nova Senha'
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
