import { IsNumber, Max, Min } from 'class-validator';

/** Where the person is. China only: that is where our regions list covers. */
export class LocateDto {
  @IsNumber()
  @Min(15)
  @Max(55)
  lat!: number;

  @IsNumber()
  @Min(70)
  @Max(140)
  lng!: number;
}
