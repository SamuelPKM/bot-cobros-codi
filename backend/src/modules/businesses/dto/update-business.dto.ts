import { IsOptional, IsString, Length, Matches } from 'class-validator';
import {
  API_KEY_MESSAGE,
  BUSINESS_NAME_MAX,
  BUSINESS_NAME_MESSAGE,
  WEBHOOK_SECRET_MESSAGE,
} from './business-validation.constants';

/** Todos opcionales: solo cambia lo que viene. */
export class UpdateBusinessDto {
  @IsOptional()
  @IsString()
  @Length(1, BUSINESS_NAME_MAX, { message: BUSINESS_NAME_MESSAGE })
  @Matches(/\S/, { message: BUSINESS_NAME_MESSAGE })
  name?: string;

  /** Se valida con pey antes de guardarla. */
  @IsOptional()
  @IsString()
  @Length(8, 300, { message: API_KEY_MESSAGE })
  @Matches(/^\S+$/, { message: API_KEY_MESSAGE })
  peyApiKey?: string;

  /** Engrane de la API key > Crear Webhook, en el portal de pey. */
  @IsOptional()
  @IsString()
  @Matches(/^whsec_\S{8,200}$/, { message: WEBHOOK_SECRET_MESSAGE })
  peyWebhookSecret?: string;
}
