import { Injectable, Logger, ConflictException, NotFoundException } from '@nestjs/common';
import { MasterPrismaService } from '../prisma/master-prisma.service';
import { HistoriqueLectureDto } from './dto/HistoriqueLecture.dto';

@Injectable()
export class HistoriqueLectureService {
    private readonly logger = new Logger(HistoriqueLectureService.name);

    constructor(private readonly masterPrisma: MasterPrismaService) {}

    // ─── Créer une historique de sorti ──── //
    async createHistoriqueLecture(dto: HistoriqueLectureDto): Promise<{id: number}> {
    
        const historiqueLecture = await this.masterPrisma.historiqueLecture.create({
            data: {
                file_name: dto.file_name,
                status: 'failed',
                error_message: dto.error_message ?? null,
                file_type: 'csv_stats'
            },
        });

        this.logger.log(`Historique creer : ${dto.file_name}`);

        return {
            id: historiqueLecture.id,
        };
    }

    // ─── Update status to success ──── //
    async updateHistoriqueLectureToSucess(histo_id : number): Promise<void> {
    
        const existing = await this.masterPrisma.historiqueLecture.update({
            where: { id: histo_id },
            data: {
                status: "success"
            }
        });
        if (!existing) {
            throw new ConflictException(`Fichier non repertorie`);
        }

        existing

        this.logger.log(`Historique mis a jour : ${histo_id}`);

        return ;
    }

}
