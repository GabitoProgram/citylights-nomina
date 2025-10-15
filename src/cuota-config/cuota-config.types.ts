// Interfaz flexible para conceptos dinámicos
export interface ConceptosCuota {
  [key: string]: number;
}

// Conceptos por defecto para retrocompatibilidad
export interface ConceptosCuotaDefault {
  jardinFrente: number;
  jardinGeneral: number;
  recojoBasura: number;
  limpieza: number;
  luzGradas: number;
  cera: number;
  ace: number;
  lavanderia: number;
  ahorroAdministracion: number;
  agua: number;
}

// Metadata de un concepto
export interface ConceptoMetadata {
  id: number;
  key: string;
  label: string;
  descripcion?: string;
  activo: boolean;
  fechaCreacion: Date;
  fechaActualizacion: Date;
}

// Configuración completa con metadata
export interface ConfiguracionCuota {
  id: number;
  conceptos: ConceptosCuota;
  conceptosMetadata: ConceptoMetadata[];
  montoTotal: number;
  fechaActualizacion: Date;
}

// DTO para actualizar cuotas (dinámico)
export interface ActualizarCuotaDto extends ConceptosCuota {}