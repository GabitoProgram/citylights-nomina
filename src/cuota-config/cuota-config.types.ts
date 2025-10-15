export interface ConceptosCuota {
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

export interface ConfiguracionCuota {
  id: number;
  conceptos: ConceptosCuota;
  montoTotal: number;
  fechaActualizacion: Date;
}

export interface ActualizarCuotaDto {
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