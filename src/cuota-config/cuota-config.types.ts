export interface ConceptosCuota {
  jardinFrente?: number;
  jardinGeneral?: number;
  recojoBasura?: number;
  limpieza?: number;
  luzGradas?: number;
  cera?: number;
  ace?: number;
  lavanderia?: number;
  ahorroAdministracion?: number;
  agua?: number;
  // 🆕 Permitir conceptos adicionales dinámicos
  [key: string]: number | undefined;
}

export interface ConfiguracionCuota {
  id: number;
  conceptos: ConceptosCuota;
  montoTotal: number;
  fechaActualizacion: Date;
}

// 🆕 Configuración de conceptos con metadatos
export interface ConceptoMetadata {
  key: string;
  label: string;
  descripcion: string;
  orden: number;
  activo: boolean;
}

// 🆕 Lista de conceptos predefinidos con sus metadatos
export const CONCEPTOS_PREDEFINIDOS: ConceptoMetadata[] = [
  { key: 'jardinFrente', label: 'Jardín Frente del Bloque', descripcion: 'Mantenimiento jardín frontal', orden: 1, activo: true },
  { key: 'jardinGeneral', label: 'Jardín General', descripcion: 'Mantenimiento jardín general', orden: 2, activo: true },
  { key: 'recojoBasura', label: 'Recojo de Basura', descripcion: 'Servicio de recolección de basura', orden: 3, activo: true },
  { key: 'limpieza', label: 'Limpieza', descripcion: 'Servicio de limpieza general', orden: 4, activo: true },
  { key: 'luzGradas', label: 'Luz Gradas', descripcion: 'Iluminación de gradas y escaleras', orden: 5, activo: true },
  { key: 'cera', label: 'Cera', descripcion: 'Materiales de cera para pisos', orden: 6, activo: true },
  { key: 'ace', label: 'Ace', descripcion: 'Materiales de limpieza ace', orden: 7, activo: true },
  { key: 'lavanderia', label: 'Lavandería', descripcion: 'Servicio de lavandería común', orden: 8, activo: true },
  { key: 'ahorroAdministracion', label: 'Ahorro Administración', descripcion: 'Fondo de ahorro administrativo', orden: 9, activo: true },
  { key: 'agua', label: 'Agua', descripcion: 'Servicio de agua potable', orden: 10, activo: true },
];

// 🆕 DTO actualizado para soportar conceptos dinámicos
export interface ActualizarCuotaDto {
  jardinFrente?: number;
  jardinGeneral?: number;
  recojoBasura?: number;
  limpieza?: number;
  luzGradas?: number;
  cera?: number;
  ace?: number;
  lavanderia?: number;
  ahorroAdministracion?: number;
  agua?: number;
  // Permitir conceptos adicionales dinámicos
  [key: string]: number | undefined;
}