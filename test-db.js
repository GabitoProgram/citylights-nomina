const { PrismaClient } = require('@prisma/client');
require('dotenv').config();

async function testDatabase() {
  const prisma = new PrismaClient();
  
  try {
    console.log('🔗 Conectando a la base de datos...');
    console.log('📍 URL de la base de datos:', process.env.DATABASE_URL);
    
    // Verificar conexión
    await prisma.$connect();
    console.log('✅ Conexión exitosa!');
    
    // Verificar si existe la tabla CuotaMensualResidente
    try {
      const count = await prisma.cuotaMensualResidente.count();
      console.log(`✅ Tabla CuotaMensualResidente existe. Registros: ${count}`);
      
      // Intentar crear una cuota de prueba
      const testCuota = await prisma.cuotaMensualResidente.create({
        data: {
          userId: "test-user",
          userName: "Test User",
          userEmail: "test@example.com",
          anio: 2025,
          mes: 10,
          monto: 100.0,
          montoMorosidad: 0.0,
          montoTotal: 100.0,
          fechaVencimiento: new Date(),
          fechaVencimientoGracia: new Date(),
          diasMorosidad: 0,
          porcentajeMorosidad: 10.0
        }
      });
      console.log('✅ Cuota de prueba creada:', testCuota.id);
      
      // Eliminar la cuota de prueba
      await prisma.cuotaMensualResidente.delete({
        where: { id: testCuota.id }
      });
      console.log('🧹 Cuota de prueba eliminada');
      
    } catch (tableError) {
      console.error('❌ Error con la tabla CuotaMensualResidente:', tableError.message);
    }
    
  } catch (error) {
    console.error('❌ Error de conexión:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

testDatabase();