import { Test, TestingModule } from '@nestjs/testing';
import { RingoverService } from './ringover.service';

describe('RingoverService', () => {
  let service: RingoverService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [RingoverService],
    }).compile();

    service = module.get<RingoverService>(RingoverService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
