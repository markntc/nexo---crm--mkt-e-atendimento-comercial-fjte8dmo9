// src/contexts/BrandContext.tsx
import React, { createContext, useContext, useEffect, useState } from 'react'
import pb from '@/lib/pocketbase/client'
import type { Marca } from '@/types'
import { useAuth } from './AuthContext'

export interface BrandContextType {
  marcas: Marca[]
  activeBrand: Marca | null // null significa "Consolidado"
  isConsolidated: boolean
  isLoadingBrands: boolean
  setActiveBrandId: (id: string | null) => void
  refreshMarcas: () => Promise<void>
  currentBrandColor: string
}

const BrandContext = createContext<BrandContextType | undefined>(undefined)

const BRAND_STORAGE_KEY = 'ntc_active_brand_id'

export const BrandProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated } = useAuth()
  const [marcas, setMarcas] = useState<Marca[]>([])
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
      setMarcas(records)

      // Se activeBrandId não estiver setado ou não for válido nas marcas existentes
      if (activeBrandId && activeBrandId !== 'consolidado') {
        const found = records.find((m) => m.id === activeBrandId)
        if (!found && records.length > 0) {
          // Default: ou consolidado ou primeira marca
          setActiveBrandIdState(null)
          localStorage.removeItem(BRAND_STORAGE_KEY)
        }
      }
    } catch (err) {
      console.error('Erro ao buscar marcas:', err)
    } finally {
      setIsLoadingBrands(false)
    }
  }

  useEffect(() => {
    fetchMarcas()
  }, [isAuthenticated])

  const setActiveBrandId = (id: string | null) => {
    setActiveBrandIdState(id)
    if (id) {
      localStorage.setItem(BRAND_STORAGE_KEY, id)
    } else {
      localStorage.removeItem(BRAND_STORAGE_KEY)
    }
  }

  const isConsolidated = activeBrandId === null || activeBrandId === 'consolidado'
  const activeBrand = !isConsolidated ? marcas.find((m) => m.id === activeBrandId) || null : null

  const currentBrandColor = activeBrand?.cor_destaque || '#1B4F72'

  return (
    <BrandContext.Provider
      value={{
        marcas,
        activeBrand,
        isConsolidated,
        isLoadingBrands,
        setActiveBrandId,
        refreshMarcas: fetchMarcas,
        currentBrandColor,
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
