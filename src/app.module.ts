import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AppointmentsModule } from './appointments/appointments.module';
import { AuthModule } from './auth/auth.module';
import { BillingBatchesModule } from './billing-batches/billing-batches.module';
import { CallsModule } from './calls/calls.module';
import { CategoriesModule } from './categories/categories.module';
import { ClinicProfileModule } from './clinic-profile/clinic-profile.module';
import { ClinicalAppointmentsModule } from './clinical-appointments/clinical-appointments.module';
import { FinancialEntriesModule } from './financial-entries/financial-entries.module';
import { FinancialExitsModule } from './financial-exits/financial-exits.module';
import { GuideImportsModule } from './guide-imports/guide-imports.module';
import { HealthPlansModule } from './health-plans/health-plans.module';
import { HealthProfessionalsModule } from './health-professionals/health-professionals.module';
import { InsuranceCardsModule } from './insurance-cards/insurance-cards.module';
import { InsuranceGuidesModule } from './insurance-guides/insurance-guides.module';
import { MessagesModule } from './messages/messages.module';
import { PatientsModule } from './patients/patients.module';
import { PayablesModule } from './payables/payables.module';
import { PrismaModule } from './prisma/prisma.module';
import { ProceduresModule } from './procedures/procedures.module';
import { ProductsModule } from './products/products.module';
import { SectorsModule } from './sectors/sectors.module';
import { SpecialtiesModule } from './specialties/specialties.module';
import { StockBatchesModule } from './stock-batches/stock-batches.module';
import { StockExitsModule } from './stock-exits/stock-exits.module';
import { StorageLocationsModule } from './storage-locations/storage-locations.module';
import { SuppliersModule } from './suppliers/suppliers.module';
import { UsersModule } from './users/users.module';

@Module({
  imports: [
    PrismaModule,
    UsersModule,
    SpecialtiesModule,
    HealthProfessionalsModule,
    HealthPlansModule,
    PatientsModule,
    InsuranceCardsModule,
    InsuranceGuidesModule,
    GuideImportsModule,
    ProceduresModule,
    ClinicalAppointmentsModule,
    AppointmentsModule,
    CallsModule,
    MessagesModule,
    AuthModule,
    ClinicProfileModule,
    CategoriesModule,
    ProductsModule,
    SectorsModule,
    StorageLocationsModule,
    SuppliersModule,
    StockBatchesModule,
    StockExitsModule,
    BillingBatchesModule,
    FinancialEntriesModule,
    PayablesModule,
    FinancialExitsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
