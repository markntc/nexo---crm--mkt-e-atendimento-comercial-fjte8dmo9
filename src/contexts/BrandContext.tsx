// src/contexts/BrandContext.tsx
import React, { createContext, useContext, useEffect, useState } from 'react'
import pb from '@/lib/pocketbase/client'
import type { Marca } from '@/types'
import { useAuth } from './AuthContext'

export interface BrandContextType {
  marcas: Marca[] // lista filtrada de marcas autorizadas para este usuário
  todasMarcas: Marca[] // todas as marcas ativas cadastradas no CRM
  activeBrand: Marca | null // null significa "Consolidado" (apenas Admin/Diretoria)
  isConsolidated: boolean
  isLoadingBrands: boolean
  setActiveBrandId: (id: string | null) => void
  refreshMarcas: () => Promise<void>
  currentBrandColor: string
  podeVerConsolidado: boolean
}

const BrandContext = createContext<BrandContextType | undefined>(undefined)

const BRAND_STORAGE_KEY = 'ntc_active_brand_id'

export const BrandProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, podeVerConsolidado, marcasAutorizadasIds } = useAuth()
  const [todasMarcas, setTodasMarcas] = useState<Marca[]>([])
  const [activeBrandId, setActiveBrandIdState] = useState<string | null>(() => {
    return localStorage.getItem(BRAND_STORAGE_KEY)
  })
  const [isLoadingBrands, setIsLoadingBrands] = useState(true)

  const fetchMarcas = async () => {
    if (!isAuthenticated) {
      setIsLoadingBrands(false)
      return
    }
    try {
      const records = await pb.collection('marcas').getFullList<Marca>({
        filter: 'ativo = true',
        sort: 'nome',
      })
      setTodasMarcas(records)
    } catch (err) {
      console.error('Erro ao buscar marcas:', err)
    } finally {
      setIsLoadingBrands(false)
    }
  }

  useEffect(() => {
    fetchMarcas()
  }, [isAuthenticated])

  // Marcas autorizadas para o usuário ativo:
  // Se marcasAutorizadasIds === null (Admin / Diretoria), todas as marcas ativas.
  // Caso contrário, apenas as marcas cujo id está em marcasAutorizadasIds.
  const marcasAutorizadas = React.useMemo(() => {
    if (marcasAutorizadasIds === null) {
      return todasMarcas
    }
    return todasMarcas.filter((m) => marcasAutorizadasIds.includes(m.id))
  }, [todasMarcas, marcasAutorizadasIds])

  // Validação e coerção da marca ativa conforme o perfil:
  // Supervisor e Vendedor operam UMA marca por vez, NUNCA veem "Consolidado".
  useEffect(() => {
    if (isLoadingBrands || marcasAutorizadas.length === 0) return

    if (!podeVerConsolidado) {
      // Usuário não pode ver consolidado: DEVE ter uma marca autorizada ativa
      const isValidBrand =
        activeBrandId &&
        activeBrandId !== 'consolidado' &&
        marcasAutorizadas.some((m) => m.id === activeBrandId)

      if (!isValidBrand) {
        // Seleciona a primeira marca autorizada disponível
        const fallbackId = marcasAutorizadas[0].id
        setActiveBrandIdState(fallbackId)
        localStorage.setItem(BRAND_STORAGE_KEY, fallbackId)
      }
    } else {
      // Usuário pode ver consolidado (Admin/Diretoria)
      if (activeBrandId && activeBrandId !== 'consolidado') {
        const found = todasMarcas.find((m) => m.id === activeBrandId)
        if (!found) {
          setActiveBrandIdState(null)
          localStorage.removeItem(BRAND_STORAGE_KEY)
        }
      }
    }
  }, [podeVerConsolidado, marcasAutorizadas, activeBrandId, isLoadingBrands, todasMarcas])

  const setActiveBrandId = (id: string | null) => {
    // Se não puder ver consolidado e tentou setar null/consolidado, proíbe e mantém primeira autorizada
    if (!podeVerConsolidado && (!id || id === 'consolidado')) {
      if (marcasAutorizadas.length > 0) {
        const fallback = marcasAutorizadas[0].id
        setActiveBrandIdState(fallback)
        localStorage.setItem(BRAND_STORAGE_KEY, fallback)
      }
      return
    }

    setActiveBrandIdState(id)
    if (id && id !== 'consolidado') {
      localStorage.setItem(BRAND_STORAGE_KEY, id)
    } else {
      localStorage.removeItem(BRAND_STORAGE_KEY)
    }
  }

  // Se o usuário não puder ver consolidado, isConsolidated é SEMPRE false
  const isConsolidated =
    podeVerConsolidado && (activeBrandId === null || activeBrandId === 'consolidado')
  const activeBrand = !isConsolidated
    ? marcasAutorizadas.find((m) => m.id === activeBrandId) || marcasAutorizadas[0] || null
    : null

  const currentBrandColor = activeBrand?.cor_destaque || '#1B4F72'

  return (
    <BrandContext.Provider
      value={{
        marcas: marcasAutorizadas,
        todasMarcas,
        activeBrand,
        isConsolidated,
        isLoadingBrands,
        setActiveBrandId,
        refreshMarcas: fetchMarcas,
        currentBrandColor,
        podeVerConsolidado,
      }}
    >
      {children}
    </BrandContext.Provider>
  )
}

export const useBrand = () => {
  const context = useContext(BrandContext)
  if (!context) {
    throw new Error('useBrand must be used within a BrandProvider')
  }
  return context
}
