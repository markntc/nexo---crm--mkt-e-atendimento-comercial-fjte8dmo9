// src/pages/Login.tsx
import React, { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
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
import { Loader2, ShieldCheck, Layers } from 'lucide-react'

export default function Login() {
  const navigate = useNavigate()
  const { login } = useAuth()

  const [email, setEmail] = useState('skip.adm@ntc.ind.br')
  const [password, setPassword] = useState('Skip@Pass')
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setIsLoading(true)

    try {
      await login(email.trim(), password)
      navigate('/')
    } catch (err: unknown) {
      console.error('Falha de login:', err)
      const msg =
        err instanceof Error ? err.message : 'Credenciais inválidas. Verifique seu e-mail e senha.'
      setError(msg || 'Falha na autenticação')
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
          <p className="text-sm text-[#5D6D7E] mt-1">
            Plataforma Multibrand de CRM, Vendas & Governança
          </p>
        </div>

        <Card className="shadow-sm border-[#D5DBDB] bg-white">
          <CardHeader className="space-y-1 pb-4">
            <CardTitle className="text-xl font-bold text-[#1C2833]">Acessar Conta</CardTitle>
            <CardDescription className="text-[#5D6D7E]">
              Entre com as suas credenciais corporativas NTC
            </CardDescription>
          </CardHeader>
          <form onSubmit={handleSubmit}>
            <CardContent className="space-y-4">
              {error && (
                <Alert variant="destructive" className="bg-red-50 text-red-800 border-red-200 py-2">
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
                  placeholder="ex: seu.nome@ntc.ind.br"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="h-10 border-[#D5DBDB] focus-visible:ring-[#1B4F72]"
                />
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label
                    htmlFor="password"
                    className="text-xs font-semibold uppercase tracking-wider text-[#5D6D7E]"
                  >
                    Senha
                  </Label>
                  <Link
                    to="/forgot-password"
                    className="text-xs font-medium text-[#1B4F72] hover:text-[#154360] hover:underline"
                  >
                    Esqueci minha senha
                  </Link>
                </div>
                <Input
                  id="password"
                  type="password"
                  required
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="h-10 border-[#D5DBDB] focus-visible:ring-[#1B4F72]"
                />
              </div>

              <div className="p-3 bg-blue-50/60 rounded-lg border border-blue-100 flex items-start space-x-2 text-xs text-[#1B4F72]">
                <ShieldCheck className="w-4 h-4 mt-0.5 shrink-0 text-[#1B4F72]" />
                <span>
                  Ambiente seguro Multi-Tenancy com isolamento de dados por marca e conformidade
                  LGPD.
                </span>
              </div>
            </CardContent>

            <CardFooter className="pt-2">
              <Button
                type="submit"
                disabled={isLoading}
                className="w-full h-10 font-semibold bg-[#1B4F72] hover:bg-[#154360] text-white transition-colors"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Entrando...
                  </>
                ) : (
                  'Entrar no Sistema'
                )}
              </Button>
            </CardFooter>
          </form>
        </Card>

        <p className="text-center text-xs text-[#5D6D7E] mt-6">
          © {new Date().getFullYear()} NTC Indústria de Plásticos Injetados e Produtos Próprios
        </p>
      </div>
    </div>
  )
}
