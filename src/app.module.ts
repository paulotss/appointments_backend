import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AppointmentsModule } from './appointments/appointments.module';
import { AuthModule } from './auth/auth.module';
import { CallsModule } from './calls/calls.module';
import { CategoriesModule } from './categories/categories.module';
import { HealthProfessionalsModule } from './health-professionals/health-professionals.module';
import { MessagesModule } from './messages/messages.module';
import { PrismaModule } from './prisma/prisma.module';
import { ProductsModule } from './products/products.module';
import { SectorsModule } from './sectors/sectors.module';
import { SpecialtiesModule } from './specialties/specialties.module';
import { StockBatchesModule } from './stock-batches/stock-batches.module';
import { StockExitsModule } from './stock-exits/stock-exits.module';
import { StorageLocationsModule } from './storage-locations/storage-locations.module';
import { UsersModule } from './users/users.module';

@Module({
  imports: [
    PrismaModule,
    UsersModule,
    SpecialtiesModule,
    HealthProfessionalsModule,
    AppointmentsModule,
    CallsModule,
    MessagesModule,
    AuthModule,
    CategoriesModule,
    ProductsModule,
    SectorsModule,
    StorageLocationsModule,
    StockBatchesModule,
    StockExitsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
