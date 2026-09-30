// src/pages/ForgotPassword.tsx
import React, { useState } from 'react'
import { Link } from 'react-router-dom'
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
import { Loader2, ArrowLeft, CheckCircle2, Layers } from 'lucide-react'

export default function ForgotPassword() {
  const { requestPasswordReset } = useAuth()
  const [email, setEmail] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setIsLoading(true)

    try {
      await requestPasswordReset(email.trim())
      setSubmitted(true)
    } catch (err: unknown) {
      console.error('Erro de recuperação de senha:', err)
      const msg = err instanceof Error ? err.message : 'Falha ao solicitar recuperação.'
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
          <p className="text-sm text-[#5D6D7E] mt-1">Recuperação de Acesso Corporativo</p>
        </div>

        <Card className="shadow-sm border-[#D5DBDB] bg-white">
          <CardHeader className="space-y-1 pb-4">
            <CardTitle className="text-xl font-bold text-[#1C2833]">Esqueci minha senha</CardTitle>
            <CardDescription className="text-[#5D6D7E]">
              Informe seu e-mail corporativo cadastrado para receber as instruções de redefinição.
            </CardDescription>
          </CardHeader>

          {submitted ? (
            <CardContent className="space-y-4 pt-2">
              <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-lg flex items-start space-x-3 text-emerald-800">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 mt-0.5 shrink-0" />
                <div className="text-sm">
                  <p className="font-semibold">E-mail de redefinição enviado!</p>
                  <p className="mt-1 text-xs text-emerald-700">
                    Se o endereço <strong>{email}</strong> constar em nossa base corporativa, você
                    receberá um link seguro para cadastrar uma nova senha.
                  </p>
                </div>
              </div>
              <div className="pt-2">
                <Link to="/login" className="w-full">
                  <Button variant="outline" className="w-full border-[#D5DBDB]">
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    Voltar para o Login
                  </Button>
                </Link>
              </div>
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

                <div className="space-y-1.5">
                  <Label
                    htmlFor="email"
                    className="text-xs font-semibold uppercase tracking-wider text-[#5D6D7E]"
                  >
                    E-mail Corporativo
                  </Label>
                  <Input
                    id="email"
                    type="email"
                    required
                    placeholder="seu.nome@ntc.ind.br"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="h-10 border-[#D5DBDB] focus-visible:ring-[#1B4F72]"
                  />
                </div>
              </CardContent>

              <CardFooter className="flex flex-col space-y-3 pt-2">
                <Button
                  type="submit"
                  disabled={isLoading}
                  className="w-full h-10 font-semibold bg-[#1B4F72] hover:bg-[#154360] text-white transition-colors"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Enviando solicitação...
                    </>
                  ) : (
                    'Enviar Link de Redefinição'
                  )}
                </Button>
                <Link
                  to="/login"
                  className="text-xs text-center font-medium text-[#5D6D7E] hover:text-[#1C2833] inline-flex items-center justify-center"
                >
                  <ArrowLeft className="w-3.5 h-3.5 mr-1" />
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
