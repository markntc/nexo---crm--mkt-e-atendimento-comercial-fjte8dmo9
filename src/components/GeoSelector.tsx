// src/components/GeoSelector.tsx
// Seletor de Geografia canônico para o CRM NTC:
// 1. País: Select fechado (Brasil padrão, países do Mercosul/limítrofes, ou Outro)
// 2. UF: Select fechado com as 27 siglas canônicas brasileiras (somente para Brasil).
// 3. Cidade: Combobox com autocomplete IBGE quando Brasil (ao selecionar, preenche UF automaticamente).
//    Para fora do Brasil, input de texto livre com normalização automática.

import React, { useState, useEffect, useRef } from 'react'
import { Check, ChevronsUpDown, Globe } from 'lucide-react'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Label } from './ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select'
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from './ui/command'
import { ESTADOS_BRASIL, UF, ESTADOS_NOMES, toTitleCase, normalizarUf } from '../lib/geoUtils'
import { PAISES_CANONICOS, PAIS_PADRAO } from '../data/ibgePaises'
import { buscarMunicipios, MunicipioIBGE } from '../data/ibgeMunicipios'
import { cn } from '../lib/utils'

export interface GeoValue {
  cidade: string
  estado: string
  pais: string
}

export interface GeoSelectorProps {
  cidade: string
  estado: string
  pais?: string
  onChange: (value: GeoValue) => void
  label?: string
  cidadeLabel?: string
  estadoLabel?: string
  paisLabel?: string
  required?: boolean
  disabled?: boolean
  compact?: boolean
  idPrefix?: string
}

export function GeoSelector({
  cidade,
  estado,
  pais = PAIS_PADRAO,
  onChange,
  label,
  cidadeLabel = 'Cidade',
  estadoLabel = 'UF',
  paisLabel = 'País',
  required = false,
  disabled = false,
  compact = false,
  idPrefix = 'geo',
}: GeoSelectorProps) {
  const [openCombobox, setOpenCombobox] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [sugestoes, setSugestoes] = useState<MunicipioIBGE[]>([])
  const [isOutroPais, setIsOutroPais] = useState(false)
  const [outroPaisNome, setOutroPaisNome] = useState('')

  const isBrasil = (pais || PAIS_PADRAO).toLowerCase() === 'brasil'

  // Ao fechar ou perder o foco do popover de busca brasileira:
  // se o usuário digitou algo e não selecionou da lista, aceita a digitação livre normalizada
  const handleBrasilBlurOrClose = (nextOpen: boolean) => {
    if (!nextOpen && searchQuery.trim().length > 0) {
      const digitadoNormalizado = toTitleCase(searchQuery.trim())
      onChange({
        cidade: digitadoNormalizado,
        estado,
        pais: 'Brasil',
      })
      setSearchQuery('')
    }
    setOpenCombobox(nextOpen)
  }

  // Sincroniza estado de país se for valor livre customizado
  useEffect(() => {
    if (pais && !PAISES_CANONICOS.includes(pais as (typeof PAISES_CANONICOS)[number])) {
      setIsOutroPais(true)
      setOutroPaisNome(pais)
    } else {
      setIsOutroPais(false)
    }
  }, [pais])

  // Busca municípios IBGE conforme digitação
  useEffect(() => {
    if (!isBrasil) {
      setSugestoes([])
      return
    }
    const ufFiltro = estado && ESTADOS_BRASIL.includes(estado as UF) ? estado : undefined
    const res = buscarMunicipios(searchQuery, ufFiltro, 25)
    setSugestoes(res)
  }, [searchQuery, estado, isBrasil])

  const handlePaisChange = (novoPais: string) => {
    if (novoPais === 'Outro') {
      setIsOutroPais(true)
      onChange({
        cidade,
        estado: '',
        pais: outroPaisNome || 'Outro',
      })
    } else {
      setIsOutroPais(false)
      onChange({
        cidade,
        estado: novoPais === 'Brasil' ? estado : '',
        pais: novoPais,
      })
    }
  }

  const handleOutroPaisInput = (val: string) => {
    setOutroPaisNome(val)
    onChange({
      cidade,
      estado: '',
      pais: toTitleCase(val) || 'Outro',
    })
  }

  const handleUfChange = (novaUf: string) => {
    onChange({
      cidade,
      estado: novaUf,
      pais: isBrasil ? 'Brasil' : pais,
    })
  }

  const handleSelecionarMunicipio = (m: MunicipioIBGE) => {
    onChange({
      cidade: m.nome,
      estado: m.uf,
      pais: 'Brasil',
    })
    setOpenCombobox(false)
    setSearchQuery('')
  }

  const handleCidadeLivreChange = (val: string) => {
    onChange({
      cidade: val,
      estado,
      pais,
    })
  }

  const handleCidadeLivreBlur = () => {
    if (!isBrasil && cidade) {
      onChange({
        cidade: toTitleCase(cidade),
        estado,
        pais,
      })
    }
  }

  return (
    <div className={cn('space-y-2', compact && 'space-y-1.5')}>
      {label && <Label className="text-xs font-semibold text-slate-700 block">{label}</Label>}
      <div className="grid grid-cols-12 gap-2">
        {/* 1. Campo Cidade (Cidade primeiro) */}
        <div className={cn('col-span-12', isBrasil ? 'sm:col-span-5' : 'sm:col-span-7')}>
          <Label htmlFor={`${idPrefix}-cidade`} className="text-xs font-medium text-slate-600">
            {cidadeLabel}
            {required && <span className="text-red-500 ml-0.5">*</span>}
          </Label>

          {isBrasil ? (
            <Popover open={openCombobox} onOpenChange={handleBrasilBlurOrClose}>
              <PopoverTrigger asChild>
                <Button
                  id={`${idPrefix}-cidade`}
                  type="button"
                  variant="outline"
                  role="combobox"
                  aria-expanded={openCombobox}
                  disabled={disabled}
                  className={cn(
                    'h-9 w-full justify-between font-normal text-xs bg-white border-slate-200 px-3',
                    !cidade && 'text-slate-400',
                  )}
                >
                  <span className="truncate">{cidade || 'Buscar município (IBGE)...'}</span>
                  <ChevronsUpDown className="ml-2 h-3.5 w-3.5 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent
                className="w-[320px] p-0 z-[9999]"
                align="start"
                onCloseAutoFocus={(e) => e.preventDefault()}
              >
                <Command shouldFilter={false}>
                  <CommandInput
                    placeholder="Digite o nome do município..."
                    value={searchQuery}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && searchQuery.trim().length > 0) {
                        e.preventDefault()
                        onChange({
                          cidade: toTitleCase(searchQuery.trim()),
                          estado,
                          pais: 'Brasil',
                        })
                        setOpenCombobox(false)
                        setSearchQuery('')
                      }
                    }}
                    onBlur={() => {
                      if (searchQuery.trim().length > 0) {
                        onChange({
                          cidade: toTitleCase(searchQuery.trim()),
                          estado,
                          pais: 'Brasil',
                        })
                        setSearchQuery('')
                      }
                    }}
                    onValueChange={setSearchQuery}
                    className="h-9 text-xs"
                  />
                  <CommandList className="max-h-60 overflow-y-auto">
                    {sugestoes.length === 0 ? (
                      <div className="p-3 text-xs text-center text-slate-500">
                        {searchQuery.trim().length === 0
                          ? 'Digite para pesquisar município...'
                          : 'Nenhum município IBGE encontrado.'}
                        {searchQuery.trim().length > 0 && (
                          <button
                            type="button"
                            onClick={() => {
                              onChange({
                                cidade: toTitleCase(searchQuery),
                                estado,
                                pais: 'Brasil',
                              })
                              setOpenCombobox(false)
                              setSearchQuery('')
                            }}
                            className="mt-2 block w-full text-center text-xs text-blue-600 hover:underline"
                          >
                            Usar &ldquo;{toTitleCase(searchQuery)}&rdquo;
                          </button>
                        )}
                      </div>
                    ) : (
                      <CommandGroup heading="Municípios IBGE">
                        {sugestoes.map((m) => {
                          const isSelected =
                            cidade.toLowerCase() === m.nome.toLowerCase() &&
                            (!estado || estado === m.uf)
                          return (
                            <CommandItem
                              key={`${m.uf}-${m.nome}`}
                              value={`${m.nome} ${m.uf}`}
                              onSelect={() => handleSelecionarMunicipio(m)}
                              className="text-xs cursor-pointer flex items-center justify-between py-1.5"
                            >
                              <div className="flex items-center gap-2">
                                <Check
                                  className={cn(
                                    'h-3.5 w-3.5 text-blue-600',
                                    isSelected ? 'opacity-100' : 'opacity-0',
                                  )}
                                />
                                <span className="font-medium text-slate-800">{m.nome}</span>
                              </div>
                              <span className="text-[11px] font-semibold text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">
                                {m.uf}
                              </span>
                            </CommandItem>
                          )
                        })}
                      </CommandGroup>
                    )}
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          ) : (
            <Input
              id={`${idPrefix}-cidade`}
              value={cidade}
              onChange={(e) => handleCidadeLivreChange(e.target.value)}
              onBlur={handleCidadeLivreBlur}
              placeholder="Nome da cidade no exterior"
              disabled={disabled}
              className="h-9 text-xs bg-white border-slate-200"
            />
          )}
        </div>

        {/* 2. Campo UF (depois de Cidade) */}
        {isBrasil && (
          <div className="col-span-12 sm:col-span-3">
            <Label htmlFor={`${idPrefix}-uf`} className="text-xs font-medium text-slate-600">
              {estadoLabel}
            </Label>
            <Select value={estado || ''} onValueChange={handleUfChange} disabled={disabled}>
              <SelectTrigger
                id={`${idPrefix}-uf`}
                className="h-9 w-full bg-white text-xs border-slate-200"
              >
                <SelectValue placeholder="UF" />
              </SelectTrigger>
              <SelectContent className="z-[9999] max-h-60">
                {ESTADOS_BRASIL.map((uf) => (
                  <SelectItem key={uf} value={uf} className="text-xs">
                    <span className="font-bold">{uf}</span>{' '}
                    <span className="text-slate-400 ml-1">({ESTADOS_NOMES[uf]})</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* 3. Campo País (por último na linha) */}
        <div className={cn('col-span-12', isBrasil ? 'sm:col-span-4' : 'sm:col-span-5')}>
          <Label htmlFor={`${idPrefix}-pais`} className="text-xs font-medium text-slate-600">
            {paisLabel}
          </Label>
          <Select
            value={isOutroPais ? 'Outro' : pais || PAIS_PADRAO}
            onValueChange={handlePaisChange}
            disabled={disabled}
          >
            <SelectTrigger
              id={`${idPrefix}-pais`}
              className="h-9 w-full bg-white text-xs border-slate-200"
            >
              <SelectValue placeholder="Selecione o país" />
            </SelectTrigger>
            <SelectContent className="z-[9999]">
              {PAISES_CANONICOS.map((p) => (
                <SelectItem key={p} value={p} className="text-xs">
                  {p}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {isOutroPais && (
            <Input
              value={outroPaisNome}
              onChange={(e) => handleOutroPaisInput(e.target.value)}
              placeholder="Digite o nome do país"
              disabled={disabled}
              className="mt-1 h-8 text-xs bg-white border-slate-200"
            />
          )}
        </div>

        {!isBrasil && (
          <div className="col-span-12 mt-1">
            <p className="text-[11px] text-slate-400 italic">
              Destino internacional selecionado ({pais}). Municípios e estados seguem formato do
              país.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
