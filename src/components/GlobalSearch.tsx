// src/components/GlobalSearch.tsx
import React, { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import pb from '@/lib/pocketbase/client'
import { useBrand } from '@/contexts/BrandContext'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Search, Loader2, Building2, User, Target, Briefcase, X } from 'lucide-react'
import { formatCurrencyBRL } from '@/lib/formatters'

interface SearchResult {
  type: 'b2b' | 'b2c' | 'lead' | 'oportunidade'
  id: string
  title: string
  subtitle: string
  badge?: string
  link: string
}

export const GlobalSearch: React.FC = () => {
  const navigate = useNavigate()
  const { activeBrand } = useBrand()
  const [query, setQuery] = useState('')
  const [isOpen, setIsOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [results, setResults] = useState<SearchResult[]>([])
  const containerRef = useRef<HTMLDivElement>(null)

  // Fecha popup ao clicar fora
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  useEffect(() => {
    if (!query.trim() || query.length < 2) {
      setResults([])
      setIsLoading(false)
      return
    }

    const timer = setTimeout(async () => {
      setIsLoading(true)
      try {
        const cleanQ = query.trim().replace(/['"]/g, '')
        const res: SearchResult[] = []

        // 1. Clientes B2B
        try {
          const b2bList = await pb.collection('clientes_b2b').getList(1, 4, {
            filter: `razao_social ~ "${cleanQ}" || cnpj ~ "${cleanQ}" || nome_fantasia ~ "${cleanQ}"`,
          })
          b2bList.items.forEach((item) => {
            res.push({
              type: 'b2b',
              id: item.id,
              title: item.razao_social,
              subtitle: `CNPJ: ${item.cnpj} • ${item.email_principal || 'Sem e-mail'}`,
              badge: 'Conta B2B',
              link: `/contatos?sub=organizacoes&search=${encodeURIComponent(item.razao_social)}`,
            })
          })
        } catch {
          /* intentionally ignored */
        }

        // 2. Clientes B2C
        try {
          const b2cList = await pb.collection('clientes_b2c').getList(1, 4, {
            filter: `nome_completo ~ "${cleanQ}" || cpf ~ "${cleanQ}"`,
          })
          b2cList.items.forEach((item) => {
            res.push({
              type: 'b2c',
              id: item.id,
              title: item.nome_completo,
              subtitle: `CPF: ${item.cpf} • ${item.email_principal || 'Sem e-mail'}`,
              badge: 'Consumidor B2C',
              link: `/contatos?sub=pessoas&search=${encodeURIComponent(item.nome_completo)}`,
            })
          })
        } catch {
          /* intentionally ignored */
        }

        // 3. Oportunidades
        try {
          let oppFilter = `titulo ~ "${cleanQ}"`
          if (activeBrand) {
            oppFilter += ` && marca_id = "${activeBrand.id}"`
          }
          const oppList = await pb.collection('oportunidades').getList(1, 4, {
            filter: oppFilter,
          })
          oppList.items.forEach((item) => {
            res.push({
              type: 'oportunidade',
              id: item.id,
              title: item.titulo,
              subtitle: `Etapa: ${item.etapa_atual} • ${formatCurrencyBRL(item.valor_estimado)}`,
              badge: 'Oportunidade',
              link: `/negocios?oppId=${item.id}`,
            })
          })
        } catch {
          /* intentionally ignored */
        }

        // 4. Leads
        try {
          let leadFilter = `dados_contato ~ "${cleanQ}"`
          if (activeBrand) {
            leadFilter += ` && marca_id = "${activeBrand.id}"`
          }
          const leadList = await pb.collection('leads').getList(1, 4, {
            filter: leadFilter,
          })
          leadList.items.forEach((item) => {
            res.push({
              type: 'lead',
              id: item.id,
              title: item.dados_contato,
              subtitle: `Origem: ${item.origem} • Status: ${item.status_qualificacao}`,
              badge: 'Lead',
              link: `/leads?search=${encodeURIComponent(cleanQ)}`,
            })
          })
        } catch {
          /* intentionally ignored */
        }

        setResults(res)
        setIsOpen(true)
      } catch (err) {
        console.error('Erro na busca global:', err)
      } finally {
        setIsLoading(false)
      }
    }, 280)

    return () => clearTimeout(timer)
  }, [query, activeBrand])

  const handleSelect = (item: SearchResult) => {
    setIsOpen(false)
    setQuery('')
    navigate(item.link)
  }

  const getIcon = (type: SearchResult['type']) => {
    switch (type) {
      case 'b2b':
        return <Building2 className="w-4 h-4 text-blue-600" />
      case 'b2c':
        return <User className="w-4 h-4 text-emerald-600" />
      case 'oportunidade':
        return <Briefcase className="w-4 h-4 text-amber-600" />
      case 'lead':
        return <Target className="w-4 h-4 text-purple-600" />
    }
  }

  return (
    <div ref={containerRef} className="relative w-full max-w-md">
      <div className="relative">
        <Search className="absolute left-3 top-2.5 h-4 w-4 text-[#5D6D7E]" />
        <Input
          type="text"
          placeholder="Pesquisar no CRM (Pipedrive)..."
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            if (!isOpen && e.target.value.length >= 2) setIsOpen(true)
          }}
          onFocus={() => {
            if (results.length > 0) setIsOpen(true)
          }}
          className="pl-9 pr-8 h-9 text-xs sm:text-sm bg-[#F4F6F7] border-[#D5DBDB] focus-visible:bg-white focus-visible:ring-[#1B4F72]"
        />
        {query && (
          <button
            type="button"
            onClick={() => {
              setQuery('')
              setResults([])
              setIsOpen(false)
            }}
            className="absolute right-2.5 top-2.5 text-[#5D6D7E] hover:text-[#1C2833]"
          >
            {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <X className="w-4 h-4" />}
          </button>
        )}
      </div>

      {isOpen && query.length >= 2 && (
        <div className="absolute top-full left-0 right-0 mt-1.5 bg-white border border-[#D5DBDB] rounded-lg shadow-lg z-50 overflow-hidden max-h-96 overflow-y-auto">
          {isLoading && results.length === 0 ? (
            <div className="p-4 text-center text-xs text-[#5D6D7E] flex items-center justify-center space-x-2">
              <Loader2 className="w-4 h-4 animate-spin text-[#1B4F72]" />
              <span>Buscando na base corporativa NTC...</span>
            </div>
          ) : results.length === 0 ? (
            <div className="p-4 text-center text-xs text-[#5D6D7E]">
              Nenhum resultado encontrado para &quot;{query}&quot;
            </div>
          ) : (
            <div className="py-1 divide-y divide-[#D5DBDB]/40">
              {results.map((item) => (
                <button
                  key={`${item.type}-${item.id}`}
                  onClick={() => handleSelect(item)}
                  type="button"
                  className="w-full text-left px-3.5 py-2.5 hover:bg-slate-50 transition-colors flex items-start space-x-3 group"
                >
                  <div className="mt-0.5 p-1 rounded bg-[#F4F6F7] group-hover:bg-white transition-colors">
                    {getIcon(item.type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs font-semibold text-[#1C2833] truncate">{item.title}</p>
                      <Badge
                        variant="outline"
                        className="text-[10px] px-1.5 py-0 h-4 border-[#D5DBDB] shrink-0"
                      >
                        {item.badge}
                      </Badge>
                    </div>
                    <p className="text-[11px] text-[#5D6D7E] truncate mt-0.5">{item.subtitle}</p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
