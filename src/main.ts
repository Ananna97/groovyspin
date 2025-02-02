import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import * as config from 'config';
import * as cookieParser from 'cookie-parser';
import { TransformationInterceptor } from './responseInterceptor';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  
  app.use(cookieParser());

  app.useGlobalInterceptors(new TransformationInterceptor());
  const port = config.get<number>('port');
  await app.listen(port, () => {
    console.log(`Server port: ${port}`);
  });
}
bootstrap();
