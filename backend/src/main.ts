import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Habilitar validaciones globales para DTOs
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
    }),
  );

  // Habilitar CORS para comunicación con Next.js
  app.enableCors();

  const port = process.env.PORT ?? 4000;
  await app.listen(port);
  console.log(`Servidor API backend corriendo en http://localhost:${port}`);
}
bootstrap();
