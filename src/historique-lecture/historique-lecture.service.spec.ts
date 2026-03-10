import { Test, TestingModule } from '@nestjs/testing';
import { HistoriqueLectureService } from './historique-lecture.service';

describe('HistoriqueLectureService', () => {
  let service: HistoriqueLectureService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [HistoriqueLectureService],
    }).compile();

    service = module.get<HistoriqueLectureService>(HistoriqueLectureService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
